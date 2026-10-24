import { describe, expect, it } from 'vitest';

import { favouriteWins, finish, underdogWins, type WinnerRule } from '../__fixtures__/brackets.js';
import { InvalidFormatConfigError, RoundInProgressError } from '../errors.js';
import { DEFAULT_POINTS_RULE } from '../standings/points.js';
import type { Entrant, Match } from '../types.js';
import { pairNextSwissRound, swiss, type SwissConfig } from './swiss.js';

const entrants = (n: number): Entrant[] =>
  Array.from({ length: n }, (_, i) => ({ id: `E${String(i + 1)}`, seed: i + 1 }));

const pairs = (matches: readonly Match[], round: number) =>
  matches
    .filter((m) => m.round === round && m.result?.bye !== true)
    .map((m) => [m.entrantA, m.entrantB]);

const pairKey = (m: Match) => [m.entrantA, m.entrantB].sort().join('-');

/** Plays every pending match of the latest round with `rule`. */
function playRound(matches: readonly Match[], rule: WinnerRule): Match[] {
  let current = [...matches];
  for (const m of matches) {
    if (m.status !== 'pending' || m.entrantA === null || m.entrantB === null) continue;
    current = swiss.onMatchCompleted(current, finish(m, rule(m.entrantA, m.entrantB), [1, 0]));
  }
  return current;
}

function run(n: number, config: SwissConfig, rule: WinnerRule = favouriteWins): Match[] {
  const list = entrants(n);
  let matches = playRound(swiss.generateMatches(list, config), rule);
  while (!swiss.isComplete(matches, config)) {
    matches = playRound(pairNextSwissRound(list, matches, config), rule);
  }
  return matches;
}

describe('swiss round 1', () => {
  it('folds the seeds: top half against bottom half', () => {
    expect(
      pairs(swiss.generateMatches(entrants(8), { seriesFormat: 'bo1', rounds: 3 }), 1),
    ).toEqual([
      ['E1', 'E5'],
      ['E2', 'E6'],
      ['E3', 'E7'],
      ['E4', 'E8'],
    ]);
  });

  it('gives the bye to the lowest seed with an odd count, as a completed win', () => {
    const matches = swiss.generateMatches(entrants(7), { seriesFormat: 'bo1', rounds: 3 });
    expect(matches.find((m) => m.result?.bye === true)).toMatchObject({
      id: 'r1-bye',
      entrantA: 'E7',
      entrantB: null,
      status: 'completed',
      result: { winner: 'E7', bye: true },
    });
    expect(pairs(matches, 1)).toHaveLength(3);
  });

  it.each([
    ['rounds', { seriesFormat: 'bo1', rounds: 0 }],
    ['too many rounds', { seriesFormat: 'bo1', rounds: 8 }],
    ['thresholds', { seriesFormat: 'bo1', rounds: 3, winsToAdvance: 0 }],
  ] as const)('rejects invalid %s', (_label, config) => {
    expect(() => swiss.generateMatches(entrants(4), config)).toThrow(InvalidFormatConfigError);
  });
});

describe('swiss pairing', () => {
  const config: SwissConfig = { seriesFormat: 'bo1', rounds: 3 };

  it('pairs entrants with the same record in round 2', () => {
    const round1 = playRound(swiss.generateMatches(entrants(8), config), favouriteWins);
    const round2 = pairNextSwissRound(entrants(8), round1, config);
    // Winners E1–E4 (1-0) play each other, losers E5–E8 (0-1) too.
    expect(pairs(round2, 2)).toEqual([
      ['E1', 'E3'],
      ['E2', 'E4'],
      ['E5', 'E7'],
      ['E6', 'E8'],
    ]);
  });

  it.each([4, 6, 8, 5, 7])('runs %i entrants through every round without rematches', (n) => {
    const rounds = n % 2 === 0 ? n - 1 : n;
    const done = run(n, { seriesFormat: 'bo1', rounds: Math.min(3, rounds) }, underdogWins);
    const played = done.filter((m) => m.result?.bye !== true);
    expect(new Set(played.map(pairKey)).size).toBe(played.length);
    for (let round = 1; round <= Math.min(3, rounds); round += 1) {
      const inRound = done
        .filter((m) => m.round === round)
        .flatMap((m) => [m.entrantA, m.entrantB])
        .filter(Boolean);
      expect(new Set(inRound).size).toBe(n);
    }
  });

  it('never gives two byes to the same entrant', () => {
    const done = run(7, { seriesFormat: 'bo1', rounds: 5 });
    const byes = done.filter((m) => m.result?.bye === true).map((m) => m.entrantA);
    expect(byes).toHaveLength(5);
    expect(new Set(byes).size).toBe(5);
  });

  it('allows a rematch only when no other pairing exists', () => {
    const done = run(4, { seriesFormat: 'bo1', rounds: 4 });
    expect(done.filter((m) => m.round === 4)).toHaveLength(2);
  });

  it('stays fast when no rematch-free pairing exists', () => {
    const start = Date.now();
    const done = run(16, { seriesFormat: 'bo1', rounds: 16 });
    expect(done.filter((m) => m.round === 16)).toHaveLength(8);
    expect(Date.now() - start).toBeLessThan(5000);
  });

  it('refuses to pair the next round while the current one is being played', () => {
    const matches = swiss.generateMatches(entrants(4), config);
    expect(() => pairNextSwissRound(entrants(4), matches, config)).toThrow(RoundInProgressError);
  });

  it('returns the matches unchanged once the last round is done', () => {
    const done = run(4, { seriesFormat: 'bo1', rounds: 2 });
    expect(pairNextSwissRound(entrants(4), done, { seriesFormat: 'bo1', rounds: 2 })).toEqual(done);
  });
});

describe('swiss with advance / elimination thresholds', () => {
  const config: SwissConfig = {
    seriesFormat: 'bo1',
    rounds: 3,
    winsToAdvance: 2,
    lossesToEliminate: 2,
  };

  it('stops pairing entrants that reached a threshold', () => {
    const done = run(8, config);
    expect(done.filter((m) => m.round === 3)).toHaveLength(2);
    const round3 = done.filter((m) => m.round === 3).flatMap((m) => [m.entrantA, m.entrantB]);
    // Only the 1-1 entrants play the deciding round.
    expect(round3.sort()).toEqual(['E3', 'E4', 'E5', 'E6']);
    expect(swiss.isComplete(done, config)).toBe(true);
  });

  it('ranks by record with Buchholz and advances the top entrants', () => {
    const done = run(8, config);
    const standings = swiss.computeStandings(done, DEFAULT_POINTS_RULE, [
      'buchholz',
      'head_to_head',
    ]);
    expect(standings.slice(0, 2).map((s) => s.wins)).toEqual([2, 2]);
    expect(swiss.resolveAdvancement(standings, { count: 4 })).toMatchObject({ status: 'resolved' });
  });
});
