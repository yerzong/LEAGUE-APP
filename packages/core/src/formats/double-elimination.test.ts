import { describe, expect, it } from 'vitest';

import { favouriteWins, finish, isReady, playOut, underdogWins } from '../__fixtures__/brackets.js';
import { InvalidEntrantsError } from '../errors.js';
import { DEFAULT_POINTS_RULE } from '../standings/points.js';
import type { Entrant, Match } from '../types.js';
import { doubleElimination, type DoubleEliminationConfig } from './double-elimination.js';

const entrants = (n: number): Entrant[] =>
  Array.from({ length: n }, (_, i) => ({ id: `E${String(i + 1)}`, seed: i + 1 }));

const generate = (n: number, extra: Partial<DoubleEliminationConfig> = {}) =>
  doubleElimination.generateMatches(entrants(n), { seriesFormat: 'bo3', ...extra });

const byId = (matches: readonly Match[], id: string) => {
  const match = matches.find((m) => m.id === id);
  if (!match) throw new Error(`missing ${id}`);
  return match;
};

const placements = (matches: readonly Match[]) =>
  doubleElimination
    .computeStandings(matches, DEFAULT_POINTS_RULE, [])
    .map((s) => [s.rank, s.entrantId]);

describe('double elimination generation', () => {
  it.each([3, 4, 5, 6, 7, 8, 16])('%i entrants need 2n - 2 matches', (n) => {
    const matches = generate(n);
    expect(matches).toHaveLength(2 * n - 2);
    expect(matches.filter((m) => m.bracketSide === 'upper')).toHaveLength(n - 1);
    expect(matches.filter((m) => m.bracketSide === 'lower')).toHaveLength(n - 2);
    expect(matches.filter((m) => m.bracketSide === 'final')).toHaveLength(1);
  });

  it('sends upper bracket losers down and the upper final loser to the lower final', () => {
    const matches = generate(8);
    expect(byId(matches, 'u-r1-m1').nextLoser).toEqual({ matchId: 'l-r1-m1', slot: 'a' });
    expect(byId(matches, 'u-r1-m2').nextLoser).toEqual({ matchId: 'l-r1-m1', slot: 'b' });
    // Drop rounds take the upper losers in reverse order to delay rematches.
    expect(byId(matches, 'u-r2-m1').nextLoser).toEqual({ matchId: 'l-r2-m2', slot: 'b' });
    expect(byId(matches, 'u-r3-m1').nextLoser).toEqual({ matchId: 'l-r4-m1', slot: 'b' });
    expect(byId(matches, 'l-r4-m1').nextWinner).toEqual({ matchId: 'gf-1', slot: 'b' });
    expect(byId(matches, 'u-r3-m1').nextWinner).toEqual({ matchId: 'gf-1', slot: 'a' });
  });

  it('adds a reset final when configured, and uses the final series format for both', () => {
    const matches = generate(4, { grandFinalReset: true, finalSeriesFormat: 'bo5' });
    expect(matches).toHaveLength(7);
    expect(byId(matches, 'gf-1')).toMatchObject({
      seriesFormat: 'bo5',
      nextWinner: { matchId: 'gf-2', slot: 'a' },
    });
    expect(byId(matches, 'gf-2').seriesFormat).toBe('bo5');
    expect(byId(matches, 'u-r1-m1').seriesFormat).toBe('bo3');
  });

  it('rejects fewer than three entrants', () => {
    expect(() => generate(2)).toThrow(InvalidEntrantsError);
  });
});

describe('double elimination progression', () => {
  it('plays 8 entrants to a champion with the standard placements', () => {
    const done = playOut(doubleElimination, generate(8));
    expect(doubleElimination.isComplete(done, { seriesFormat: 'bo3' })).toBe(true);
    expect(byId(done, 'gf-1').result?.winner).toBe('E1');
    expect(placements(done)).toEqual([
      [1, 'E1'],
      [2, 'E2'],
      [3, 'E3'],
      [4, 'E4'],
      [5, 'E5'],
      [5, 'E6'],
      [7, 'E8'],
      [7, 'E7'],
    ]);
  });

  it('cancels the reset when the upper finalist wins the first grand final', () => {
    const done = playOut(doubleElimination, generate(4, { grandFinalReset: true }));
    expect(byId(done, 'gf-2').status).toBe('canceled');
    expect(doubleElimination.isComplete(done, { seriesFormat: 'bo3' })).toBe(true);
    expect(placements(done).slice(0, 2)).toEqual([
      [1, 'E1'],
      [2, 'E2'],
    ]);
  });

  it('plays the reset when the lower finalist wins the first grand final', () => {
    let bracket = generate(4, { grandFinalReset: true });
    const nextBeforeFinal = () => bracket.find((m) => isReady(m) && m.bracketSide !== 'final');
    for (let m = nextBeforeFinal(); m; m = nextBeforeFinal()) {
      bracket = doubleElimination.onMatchCompleted(
        bracket,
        finish(m, favouriteWins(m.entrantA ?? '', m.entrantB ?? '')),
      );
    }
    expect(byId(bracket, 'gf-1')).toMatchObject({ entrantA: 'E1', entrantB: 'E2' });

    bracket = doubleElimination.onMatchCompleted(bracket, finish(byId(bracket, 'gf-1'), 'E2'));
    expect(byId(bracket, 'gf-2')).toMatchObject({
      status: 'pending',
      entrantA: 'E2',
      entrantB: 'E1',
    });
    expect(doubleElimination.isComplete(bracket, { seriesFormat: 'bo3' })).toBe(false);

    bracket = doubleElimination.onMatchCompleted(bracket, finish(byId(bracket, 'gf-2'), 'E1'));
    expect(doubleElimination.isComplete(bracket, { seriesFormat: 'bo3' })).toBe(true);
    expect(placements(bracket).slice(0, 3)).toEqual([
      [1, 'E1'],
      [2, 'E2'],
      [3, 'E3'],
    ]);
  });

  it('ranks the in-progress bracket by how far each entrant got', () => {
    const matches = generate(4);
    const first = byId(matches, 'u-r1-m1');
    const next = doubleElimination.onMatchCompleted(matches, finish(first, 'E1'));
    expect(byId(next, 'l-r1-m1').entrantA).toBe('E4');
    expect(placements(next)[0]).toEqual([1, 'E1']);
  });

  it('finishes every bracket size even when the underdog always wins', () => {
    for (const n of [3, 5, 6, 7, 8]) {
      for (const reset of [false, true]) {
        const done = playOut(
          doubleElimination,
          generate(n, { grandFinalReset: reset }),
          underdogWins,
        );
        expect(done.some(isReady)).toBe(false);
        expect(doubleElimination.isComplete(done, { seriesFormat: 'bo3' })).toBe(true);
        const standings = doubleElimination.computeStandings(done, DEFAULT_POINTS_RULE, []);
        expect(standings).toHaveLength(n);
        expect(standings.filter((s) => s.rank === 1)).toHaveLength(1);
      }
    }
  });

  it('resolves advancement by placement', () => {
    const standings = doubleElimination.computeStandings(
      playOut(doubleElimination, generate(8)),
      DEFAULT_POINTS_RULE,
      [],
    );
    expect(doubleElimination.resolveAdvancement(standings, { count: 4 })).toMatchObject({
      status: 'resolved',
      advancing: ['E1', 'E2', 'E3', 'E4'],
    });
  });
});
