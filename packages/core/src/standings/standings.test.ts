import { describe, expect, it } from 'vitest';

import { bye, pendingMatch, played } from '../__fixtures__/matches.js';
import type { Match } from '../types.js';
import { DEFAULT_POINTS_RULE, type PointsRule } from './points.js';
import { computeTable, requiresManualTiebreak, type Standing } from './standings.js';
import type { TiebreakRule } from './tiebreakers.js';

const table = (
  entrants: readonly string[],
  matches: readonly Match[],
  tiebreakRule: TiebreakRule = ['head_to_head', 'game_diff'],
  pointsRule: PointsRule = DEFAULT_POINTS_RULE,
) => computeTable({ entrants, matches, pointsRule, tiebreakRule });

const order = (standings: readonly Standing[]) => standings.map((s) => s.entrantId);
const byId = (standings: readonly Standing[], id: string) => {
  const found = standings.find((s) => s.entrantId === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
};

describe('records and points', () => {
  it('aggregates series and games with the default 3/0 rule', () => {
    const standings = table(['A', 'B', 'C'], [played('A', 'B', 2, 1), played('C', 'A', 0, 2)]);
    expect(byId(standings, 'A')).toMatchObject({
      rank: 1,
      played: 2,
      wins: 2,
      losses: 0,
      draws: 0,
      gameWins: 4,
      gameLosses: 1,
      gameDiff: 3,
      points: 6,
    });
    expect(byId(standings, 'C')).toMatchObject({ played: 1, losses: 1, gameDiff: -2, points: 0 });
  });

  it('lists entrants without matches with an empty record', () => {
    expect(byId(table(['A', 'B'], []), 'B')).toMatchObject({ played: 0, points: 0, rank: 1 });
  });

  it('ignores unfinished, tiebreaker and non-counted matches for records', () => {
    const matches = [
      pendingMatch({ entrantA: 'A', entrantB: 'B' }),
      played('A', 'B', 1, 0, { isTiebreaker: true }),
      played('A', 'B', 1, 0, { status: 'canceled' }),
    ];
    expect(byId(table(['A', 'B'], matches), 'A')).toMatchObject({ played: 0, points: 0 });
  });

  it('scores draws, a bye and configurable bonuses', () => {
    const rule: PointsRule = {
      win: 2,
      loss: 0,
      draw: 1,
      bonus: [
        { kind: 'per_game_won', points: 0.5 },
        { kind: 'clean_sweep', points: 1 },
        { kind: 'forfeit_loss', points: -1 },
      ],
    };
    const matches = [
      played('A', 'B', 1, 1),
      played('A', 'C', 2, 0),
      played('B', 'C', 2, 0, { forfeit: true }),
      bye('C'),
    ];
    const standings = table(['A', 'B', 'C'], matches, [], rule);
    // A: draw 1 + game 0.5 | win 2 + games 1 + sweep 1 = 5.5
    expect(byId(standings, 'A')).toMatchObject({ points: 5.5, draws: 1, wins: 1 });
    // B: draw 1 + game 0.5 | forfeit win 2 + games 1 + sweep 1 = 5.5
    expect(byId(standings, 'B').points).toBe(5.5);
    // C: two losses (one by forfeit: -1) + bye win 2, no games played in the bye
    expect(byId(standings, 'C')).toMatchObject({ points: 1, wins: 1, losses: 2, played: 3 });
  });
});

describe('tiebreakers', () => {
  it('orders by points and records no tiebreak when nobody is tied', () => {
    const standings = table(
      ['A', 'B', 'C'],
      [played('A', 'B', 2, 0), played('B', 'C', 2, 0), played('A', 'C', 2, 0)],
    );
    expect(order(standings)).toEqual(['A', 'B', 'C']);
    expect(standings.every((s) => s.tiebreaks.length === 0 && s.tiedWith.length === 0)).toBe(true);
  });

  it('breaks a two-way tie on head to head and reports why', () => {
    // A and B both 6 points; B beat A.
    const matches = [
      played('A', 'B', 0, 2),
      played('A', 'C', 2, 0),
      played('A', 'D', 2, 0),
      played('B', 'C', 0, 2),
      played('B', 'D', 2, 0),
      played('C', 'D', 0, 2),
    ];
    const standings = table(['A', 'B', 'C', 'D'], matches);
    expect(order(standings).slice(0, 2)).toEqual(['B', 'A']);
    expect(byId(standings, 'B')).toMatchObject({
      rank: 1,
      tiebreaks: [{ criterion: 'head_to_head', value: 3, among: ['A', 'B'] }],
    });
    expect(byId(standings, 'A')).toMatchObject({
      rank: 2,
      tiebreaks: [{ criterion: 'head_to_head', value: 0, among: ['A', 'B'] }],
    });
  });

  it('cedes to the next criterion when head to head is circular', () => {
    // A>B, B>C, C>A, all 2-1 except C 2-0 over A: game diff decides.
    const matches = [played('A', 'B', 2, 1), played('B', 'C', 2, 1), played('C', 'A', 2, 0)];
    const standings = table(['A', 'B', 'C'], matches);
    expect(order(standings)).toEqual(['C', 'B', 'A']);
    expect(byId(standings, 'C').tiebreaks).toEqual([
      { criterion: 'game_diff', value: 1, among: ['A', 'B', 'C'] },
    ]);
    expect(byId(standings, 'A').tiebreaks).toEqual([
      { criterion: 'game_diff', value: -1, among: ['A', 'B', 'C'] },
    ]);
  });

  it('re-applies the chain from the start to the entrants still tied', () => {
    // A, B and C on 6 points. Head to head among the three: A 6, B 3, C 3.
    // Among B and C alone head to head is still level, so the next criterion decides.
    const matches = [
      played('A', 'B', 2, 0),
      played('A', 'C', 2, 0),
      played('D', 'A', 2, 0),
      played('B', 'C', 2, 1),
      played('C', 'B', 2, 0),
      played('B', 'D', 2, 0),
      played('C', 'D', 2, 0),
    ];
    const standings = table(['A', 'B', 'C', 'D'], matches, [
      'head_to_head',
      'head_to_head_game_diff',
    ]);
    expect(order(standings)).toEqual(['A', 'C', 'B', 'D']);
    expect(byId(standings, 'A').tiebreaks).toEqual([
      { criterion: 'head_to_head', value: 6, among: ['A', 'B', 'C'] },
    ]);
    expect(byId(standings, 'C').tiebreaks).toEqual([
      { criterion: 'head_to_head', value: 3, among: ['A', 'B', 'C'] },
      { criterion: 'head_to_head_game_diff', value: 1, among: ['B', 'C'] },
    ]);
    expect(byId(standings, 'B').tiebreaks.at(-1)).toEqual({
      criterion: 'head_to_head_game_diff',
      value: -1,
      among: ['B', 'C'],
    });
  });

  it('resolves two separate ties independently (double tie)', () => {
    // A,B on 6 and C,D on 3 after a double round of results.
    const matches = [
      played('A', 'B', 2, 1),
      played('C', 'D', 1, 2),
      played('A', 'C', 0, 2),
      played('B', 'D', 2, 0),
      played('A', 'D', 2, 0),
      played('B', 'C', 2, 0),
    ];
    const standings = table(['A', 'B', 'C', 'D'], matches);
    expect(order(standings)).toEqual(['A', 'B', 'D', 'C']);
    expect(byId(standings, 'A').tiebreaks[0]).toMatchObject({
      criterion: 'head_to_head',
      among: ['A', 'B'],
    });
    expect(byId(standings, 'D').tiebreaks[0]).toMatchObject({
      criterion: 'head_to_head',
      among: ['C', 'D'],
    });
  });

  it('flags a fully unresolved tie for a manual tiebreaker and shares the rank', () => {
    // Circular 2-1 results: identical points, head to head and game diff.
    const matches = [
      played('A', 'B', 2, 1),
      played('B', 'C', 2, 1),
      played('C', 'A', 2, 1),
      played('A', 'D', 2, 0),
      played('B', 'D', 2, 0),
      played('C', 'D', 2, 0),
    ];
    const standings = table(['A', 'B', 'C', 'D'], matches);
    expect(standings.slice(0, 3).map((s) => s.rank)).toEqual([1, 1, 1]);
    expect(byId(standings, 'D').rank).toBe(4);
    expect(byId(standings, 'A').tiedWith).toEqual(['B', 'C']);
    expect(byId(standings, 'D').tiedWith).toEqual([]);
    expect(requiresManualTiebreak(standings)).toBe(true);
  });

  it('settles the tie once the tiebreaker match is played, without adding points', () => {
    const base = [
      played('A', 'B', 1, 0, { seriesFormat: 'bo1' }),
      played('B', 'A', 1, 0, { seriesFormat: 'bo1' }),
    ];
    const before = table(['A', 'B'], base, ['head_to_head', 'game_diff', 'tiebreaker_match']);
    expect(requiresManualTiebreak(before)).toBe(true);

    const after = table(
      ['A', 'B'],
      [...base, played('B', 'A', 1, 0, { isTiebreaker: true })],
      ['head_to_head', 'game_diff', 'tiebreaker_match'],
    );
    expect(order(after)).toEqual(['B', 'A']);
    expect(byId(after, 'B')).toMatchObject({
      points: 3,
      tiebreaks: [{ criterion: 'tiebreaker_match', value: 1 }],
    });
    expect(requiresManualTiebreak(after)).toBe(false);
  });

  it('supports wins, game wins, head-to-head game diff and Buchholz', () => {
    // Swiss-like: A and B both 1-1; A's opponents scored more.
    const matches = [
      played('A', 'C', 2, 0),
      played('A', 'D', 0, 2),
      played('B', 'E', 2, 1),
      played('B', 'C', 1, 2),
      played('D', 'E', 2, 0),
    ];
    const standings = table(['A', 'B', 'C', 'D', 'E'], matches, ['buchholz']);
    // A: opponents C (3) + D (6) = 9; B: opponents E (0) + C (3) = 3.
    expect(byId(standings, 'A').tiebreaks[0]).toMatchObject({ criterion: 'buchholz', value: 9 });
    expect(byId(standings, 'B').tiebreaks[0]).toMatchObject({ criterion: 'buchholz', value: 3 });
    expect(byId(standings, 'A').rank).toBeLessThan(byId(standings, 'B').rank);

    const winsFirst = table(
      ['A', 'B'],
      [played('A', 'B', 1, 1), played('A', 'B', 2, 0)],
      ['wins'],
      {
        win: 1,
        loss: 1,
        draw: 1,
      },
    );
    expect(byId(winsFirst, 'A').tiebreaks[0]).toMatchObject({ criterion: 'wins', value: 1 });

    const gameWins = table(
      ['A', 'B', 'C'],
      [played('A', 'C', 2, 1), played('B', 'C', 1, 0)],
      ['game_diff', 'game_wins'],
    );
    expect(order(gameWins).slice(0, 2)).toEqual(['A', 'B']);
    expect(byId(gameWins, 'A').tiebreaks[0]).toMatchObject({ criterion: 'game_wins', value: 2 });

    const h2hGames = table(
      ['A', 'B'],
      [played('A', 'B', 2, 1), played('B', 'A', 2, 0)],
      ['head_to_head', 'head_to_head_game_diff'],
    );
    expect(order(h2hGames)).toEqual(['B', 'A']);
    expect(byId(h2hGames, 'B').tiebreaks[0]).toMatchObject({
      criterion: 'head_to_head_game_diff',
      value: 1,
    });
  });
});
