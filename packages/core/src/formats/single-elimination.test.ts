import { describe, expect, it } from 'vitest';

import { favouriteWins, finish, isReady, playOut, underdogWins } from '../__fixtures__/brackets.js';
import { BracketConflictError, InvalidEntrantsError, InvalidMatchResultError } from '../errors.js';
import { DEFAULT_POINTS_RULE } from '../standings/points.js';
import type { Entrant, Match } from '../types.js';
import { bracketOrder } from './bracket.js';
import { singleElimination } from './single-elimination.js';

const entrants = (n: number): Entrant[] =>
  Array.from({ length: n }, (_, i) => ({ id: `E${String(i + 1)}`, seed: i + 1 }));

const generate = (
  n: number,
  extra: { thirdPlaceMatch?: boolean; finalSeriesFormat?: 'bo5' } = {},
) => singleElimination.generateMatches(entrants(n), { seriesFormat: 'bo1', ...extra });

const byId = (matches: readonly Match[], id: string) => {
  const match = matches.find((m) => m.id === id);
  if (!match) throw new Error(`missing ${id}`);
  return match;
};

const standingsOf = (matches: readonly Match[]) =>
  singleElimination
    .computeStandings(matches, DEFAULT_POINTS_RULE, [])
    .map((s) => [s.rank, s.entrantId]);

describe('seeding order', () => {
  it('keeps the top seeds apart until the late rounds', () => {
    expect(bracketOrder(2)).toEqual([1, 2]);
    expect(bracketOrder(4)).toEqual([1, 4, 2, 3]);
    expect(bracketOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

describe('single elimination generation', () => {
  it.each([2, 3, 4, 5, 6, 7, 8, 16])('%i entrants need exactly n - 1 matches', (n) => {
    const matches = generate(n);
    expect(matches).toHaveLength(n - 1);
    expect(new Set(matches.map((m) => m.id)).size).toBe(n - 1);
  });

  it('pairs 8 entrants 1v8, 4v5, 2v7, 3v6 and links winners forward', () => {
    const matches = generate(8);
    expect(matches.filter((m) => m.round === 1).map((m) => [m.entrantA, m.entrantB])).toEqual([
      ['E1', 'E8'],
      ['E4', 'E5'],
      ['E2', 'E7'],
      ['E3', 'E6'],
    ]);
    expect(byId(matches, 'r1-m1').nextWinner).toEqual({ matchId: 'r2-m1', slot: 'a' });
    expect(byId(matches, 'r1-m2').nextWinner).toEqual({ matchId: 'r2-m1', slot: 'b' });
    expect(byId(matches, 'r3-m1')).toMatchObject({
      entrantA: null,
      sourceA: { kind: 'match', matchId: 'r2-m1', outcome: 'winner' },
      nextWinner: null,
      nextLoser: null,
    });
  });

  it('gives byes to the top seeds with 6 entrants and places them in round 2', () => {
    const matches = generate(6);
    expect(matches.filter((m) => m.round === 1).map((m) => [m.entrantA, m.entrantB])).toEqual([
      ['E4', 'E5'],
      ['E3', 'E6'],
    ]);
    expect(byId(matches, 'r2-m1')).toMatchObject({
      entrantA: 'E1',
      sourceA: { kind: 'seed', seed: 1 },
      entrantB: null,
      sourceB: { kind: 'match', matchId: 'r1-m2', outcome: 'winner' },
    });
  });

  it('handles an odd count (5): three byes, one opening match', () => {
    const matches = generate(5);
    expect(matches.filter((m) => m.round === 1).map((m) => [m.entrantA, m.entrantB])).toEqual([
      ['E4', 'E5'],
    ]);
    expect(matches.filter((m) => m.round === 2).map((m) => [m.entrantA, m.entrantB])).toEqual([
      ['E1', null],
      ['E2', 'E3'],
    ]);
  });

  it('adds a third place match fed by the semifinal losers', () => {
    const matches = generate(4, { thirdPlaceMatch: true });
    expect(matches).toHaveLength(4);
    expect(byId(matches, 'r1-m1').nextLoser).toEqual({ matchId: 'third-place', slot: 'a' });
    expect(byId(matches, 'r1-m2').nextLoser).toEqual({ matchId: 'third-place', slot: 'b' });
  });

  it('drops the third place match when a semifinalist came through a bye', () => {
    expect(generate(3, { thirdPlaceMatch: true }).map((m) => m.id)).toEqual(['r1-m2', 'r2-m1']);
  });

  it('uses the final series format for the final only', () => {
    const matches = generate(4, { finalSeriesFormat: 'bo5' });
    expect(matches.map((m) => m.seriesFormat)).toEqual(['bo1', 'bo1', 'bo5']);
  });

  it('rejects fewer than two entrants', () => {
    expect(() => singleElimination.generateMatches(entrants(1), { seriesFormat: 'bo1' })).toThrow(
      InvalidEntrantsError,
    );
  });
});

describe('single elimination progression', () => {
  it('moves winners forward until a champion is decided', () => {
    const matches = generate(8);
    const first = matches[0];
    if (!first) throw new Error('empty');
    const afterOne = singleElimination.onMatchCompleted(matches, finish(first, 'E8'));
    expect(byId(afterOne, 'r2-m1').entrantA).toBe('E8');
    expect(singleElimination.isComplete(afterOne)).toBe(false);

    const done = playOut(singleElimination, matches);
    expect(singleElimination.isComplete(done)).toBe(true);
    expect(byId(done, 'r3-m1').result?.winner).toBe('E1');
  });

  it('ranks by elimination round and shares the rank within a round', () => {
    const done = playOut(singleElimination, generate(8));
    expect(standingsOf(done)).toEqual([
      [1, 'E1'],
      [2, 'E2'],
      [3, 'E4'],
      [3, 'E3'],
      [5, 'E8'],
      [5, 'E5'],
      [5, 'E7'],
      [5, 'E6'],
    ]);
  });

  it('separates third and fourth with the third place match', () => {
    const done = playOut(singleElimination, generate(4, { thirdPlaceMatch: true }));
    expect(standingsOf(done)).toEqual([
      [1, 'E1'],
      [2, 'E2'],
      [3, 'E3'],
      [4, 'E4'],
    ]);
  });

  it('ranks entrants still alive above those already out while in progress', () => {
    const matches = generate(4);
    const first = matches[0];
    if (!first) throw new Error('empty');
    const partial = singleElimination.onMatchCompleted(matches, finish(first, 'E1'));
    expect(standingsOf(partial)).toEqual([
      [1, 'E1'],
      [2, 'E2'],
      [2, 'E3'],
      [4, 'E4'],
    ]);
  });

  it('resolves advancement by placement and flags a cut inside a shared placement', () => {
    const standings = singleElimination.computeStandings(
      playOut(singleElimination, generate(8)),
      DEFAULT_POINTS_RULE,
      [],
    );
    expect(singleElimination.resolveAdvancement(standings, { count: 4 })).toMatchObject({
      status: 'resolved',
      advancing: ['E1', 'E2', 'E4', 'E3'],
    });
    expect(singleElimination.resolveAdvancement(standings, { count: 3 })).toMatchObject({
      status: 'requires_tiebreaker',
      advancing: ['E1', 'E2'],
      tiedAtCutoff: ['E4', 'E3'],
      openSlots: 1,
    });
  });

  it('rejects a draw', () => {
    const [first] = generate(4);
    if (!first) throw new Error('empty');
    const draw: Match = {
      ...first,
      status: 'completed',
      result: { scoreA: 1, scoreB: 1, winner: null },
    };
    expect(() => singleElimination.onMatchCompleted(generate(4), draw)).toThrow(
      InvalidMatchResultError,
    );
  });

  it('allows correcting a result while the next match has not started', () => {
    const matches = generate(4);
    const [first] = matches;
    if (!first) throw new Error('empty');
    const wrong = singleElimination.onMatchCompleted(matches, finish(first, 'E4'));
    const fixed = singleElimination.onMatchCompleted(wrong, finish(first, 'E1'));
    expect(byId(fixed, 'r2-m1').entrantA).toBe('E1');
  });

  it('refuses a correction once the next match was played', () => {
    const matches = generate(4);
    const done = playOut(singleElimination, matches, favouriteWins);
    const semi = byId(done, 'r1-m1');
    expect(() => singleElimination.onMatchCompleted(done, finish(semi, 'E4'))).toThrow(
      BracketConflictError,
    );
  });

  it('never leaves a ready match behind after a full run with upsets', () => {
    for (const n of [3, 5, 6, 7]) {
      const done = playOut(singleElimination, generate(n), underdogWins);
      expect(done.some(isReady)).toBe(false);
      expect(singleElimination.isComplete(done)).toBe(true);
    }
  });
});
