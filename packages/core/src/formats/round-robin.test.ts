import { describe, expect, it } from 'vitest';

import { played } from '../__fixtures__/matches.js';
import {
  InvalidEntrantsError,
  InvalidFormatConfigError,
  InvalidMatchResultError,
  MatchNotFoundError,
} from '../errors.js';
import { DEFAULT_POINTS_RULE } from '../standings/points.js';
import type { Entrant, Match } from '../types.js';
import { doubleRoundRobin, roundRobin } from './round-robin.js';

const entrants = (n: number): Entrant[] =>
  Array.from({ length: n }, (_, i) => ({ id: `E${String(i + 1)}`, seed: i + 1 }));

const pairKey = (m: Match) => [m.entrantA, m.entrantB].sort().join('-');

function expectValidSchedule(matches: readonly Match[], n: number, legs: 1 | 2) {
  const rounds = (n % 2 === 0 ? n - 1 : n) * legs;
  expect(Math.max(...matches.map((m) => m.round))).toBe(rounds);
  expect(matches).toHaveLength(((n * (n - 1)) / 2) * legs);

  const pairs = new Map<string, number>();
  for (const m of matches) pairs.set(pairKey(m), (pairs.get(pairKey(m)) ?? 0) + 1);
  expect(pairs.size).toBe((n * (n - 1)) / 2);
  expect([...pairs.values()].every((count) => count === legs)).toBe(true);

  for (let round = 1; round <= rounds; round += 1) {
    const inRound = matches
      .filter((m) => m.round === round)
      .flatMap((m) => [m.entrantA, m.entrantB]);
    expect(new Set(inRound).size).toBe(inRound.length);
    expect(inRound).toHaveLength(n % 2 === 0 ? n : n - 1);
  }
}

describe('round robin generation', () => {
  it.each([4, 6, 8, 5, 7])('schedules %i entrants: everyone meets once, once per round', (n) => {
    const matches = roundRobin.generateMatches(entrants(n), { seriesFormat: 'bo3' });
    expectValidSchedule(matches, n, 1);
    expect(
      matches.every((m) => m.status === 'pending' && m.result === null && m.seriesFormat === 'bo3'),
    ).toBe(true);
    expect(new Set(matches.map((m) => m.id)).size).toBe(matches.length);
  });

  it('gives each entrant exactly one bye round with an odd count', () => {
    const matches = roundRobin.generateMatches(entrants(5), { seriesFormat: 'bo1' });
    for (const { id } of entrants(5)) {
      const roundsPlayed = new Set(
        matches.filter((m) => m.entrantA === id || m.entrantB === id).map((m) => m.round),
      );
      expect(5 - roundsPlayed.size).toBe(1);
    }
  });

  it('orders entrants by seed, not by input order, so the output is deterministic', () => {
    const shuffled = [...entrants(6)].reverse();
    expect(roundRobin.generateMatches(shuffled, { seriesFormat: 'bo1' })).toEqual(
      roundRobin.generateMatches(entrants(6), { seriesFormat: 'bo1' }),
    );
  });

  it('plays a second leg with the slots swapped in double round robin', () => {
    const matches = doubleRoundRobin.generateMatches(entrants(4), { seriesFormat: 'bo1' });
    expectValidSchedule(matches, 4, 2);
    const firstLeg = matches.filter((m) => m.round <= 3);
    for (const m of firstLeg) {
      const ret = matches.find(
        (x) => x.round === m.round + 3 && x.entrantA === m.entrantB && x.entrantB === m.entrantA,
      );
      expect(ret).toBeDefined();
    }
  });

  it.each([
    ['fewer than two entrants', entrants(1)],
    [
      'duplicate ids',
      [
        { id: 'X', seed: 1 },
        { id: 'X', seed: 2 },
      ],
    ],
    [
      'duplicate seeds',
      [
        { id: 'X', seed: 1 },
        { id: 'Y', seed: 1 },
      ],
    ],
  ])('rejects %s', (_label, list) => {
    expect(() => roundRobin.generateMatches(list, { seriesFormat: 'bo1' })).toThrow(
      InvalidEntrantsError,
    );
  });

  it('rejects an unknown series format from config data', () => {
    expect(() => roundRobin.generateMatches(entrants(4), { seriesFormat: 'bo7' as never })).toThrow(
      InvalidFormatConfigError,
    );
  });
});

describe('round robin results', () => {
  const schedule = roundRobin.generateMatches(entrants(4), { seriesFormat: 'bo3' });
  const first = schedule[0] as Match;
  const complete = (match: Match, scoreA: number, scoreB: number): Match => ({
    ...played(match.entrantA ?? '', match.entrantB ?? '', scoreA, scoreB),
    id: match.id,
    round: match.round,
    position: match.position,
  });

  it('records a completed match without touching the others', () => {
    const next = roundRobin.onMatchCompleted(schedule, complete(first, 2, 0));
    expect(next.find((m) => m.id === first.id)).toMatchObject({
      status: 'completed',
      result: { winner: first.entrantA },
    });
    expect(next.filter((m) => m.status === 'pending')).toHaveLength(schedule.length - 1);
    expect(roundRobin.isComplete(next)).toBe(false);
  });

  it('is complete when every match is finished or canceled', () => {
    const done = schedule.map((m, i) =>
      i === 0 ? { ...m, status: 'canceled' as const } : complete(m, 2, 1),
    );
    expect(roundRobin.isComplete(done)).toBe(true);
  });

  it('rejects results that do not fit the match', () => {
    expect(() =>
      roundRobin.onMatchCompleted(schedule, { ...complete(first, 2, 0), id: 'nope' }),
    ).toThrow(MatchNotFoundError);
    expect(() => roundRobin.onMatchCompleted(schedule, { ...first, status: 'live' })).toThrow(
      InvalidMatchResultError,
    );
    expect(() =>
      roundRobin.onMatchCompleted(schedule, {
        ...complete(first, 2, 0),
        result: { scoreA: 2, scoreB: 0, winner: 'E9' },
      }),
    ).toThrow(InvalidMatchResultError);
    expect(() =>
      roundRobin.onMatchCompleted(schedule, { ...complete(first, 2, 0), entrantA: 'E9' }),
    ).toThrow(InvalidMatchResultError);
  });

  it('computes standings from the matches and resolves advancement', () => {
    // E1 wins everything, E2 beats E3 and E4, E3 beats E4.
    const results = schedule.map((m) => {
      const [a, b] = [m.entrantA ?? '', m.entrantB ?? ''];
      return complete(m, a < b ? 2 : 0, a < b ? 0 : 2);
    });
    const standings = roundRobin.computeStandings(results, DEFAULT_POINTS_RULE, ['head_to_head']);
    expect(standings.map((s) => s.entrantId)).toEqual(['E1', 'E2', 'E3', 'E4']);
    expect(roundRobin.resolveAdvancement(standings, { count: 2 })).toEqual({
      status: 'resolved',
      advancing: ['E1', 'E2'],
      eliminated: ['E3', 'E4'],
    });
  });

  it('asks for a tiebreaker when the cut falls inside an unresolved tie', () => {
    // E2, E3, E4 beat each other in a circle with identical scores; E1 beats all.
    const winners: Record<string, string> = { 'E2-E3': 'E2', 'E3-E4': 'E3', 'E2-E4': 'E4' };
    const results = schedule.map((m) => {
      const key = pairKey(m);
      const winner = key.startsWith('E1') ? 'E1' : winners[key];
      return complete(m, winner === m.entrantA ? 2 : 1, winner === m.entrantA ? 1 : 2);
    });
    const standings = roundRobin.computeStandings(results, DEFAULT_POINTS_RULE, [
      'head_to_head',
      'game_diff',
    ]);
    const result = roundRobin.resolveAdvancement(standings, { count: 2 });
    expect(result).toMatchObject({
      status: 'requires_tiebreaker',
      advancing: ['E1'],
      eliminated: [],
      openSlots: 1,
    });
    expect(result.status === 'requires_tiebreaker' && [...result.tiedAtCutoff].sort()).toEqual([
      'E2',
      'E3',
      'E4',
    ]);
  });

  it('rejects an advancement count larger than the table', () => {
    expect(() => roundRobin.resolveAdvancement([], { count: 1 })).toThrow(InvalidFormatConfigError);
  });
});
