import { describe, expect, it } from 'vitest';

import type { ChampionId, DraftPick, Game } from '../types.js';
import {
  computeFearlessLocks,
  lockedChampions,
  validateDraft,
  type FearlessSeries,
} from './fearless.js';

const A = 'team-a';
const B = 'team-b';

/** Five picks per side: game n uses champions n*100+1..5 for A and n*100+6..10 for B. */
const picksFor = (n: number): DraftPick[] => [
  ...[1, 2, 3, 4, 5].map((i) => ({ entrantId: A, championId: n * 100 + i })),
  ...[6, 7, 8, 9, 10].map((i) => ({ entrantId: B, championId: n * 100 + i })),
];

const game = (
  number: number,
  status: Game['status'] = 'completed',
  picks = picksFor(number),
): Game => ({
  number,
  status,
  blue: A,
  red: B,
  winner: status === 'completed' ? A : null,
  picks,
});

const series = (games: Game[]): FearlessSeries => ({ entrants: [A, B], games });
const range = (from: number, to: number): ChampionId[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe('fearless locks (per team)', () => {
  it('has nothing locked before game 1', () => {
    expect(computeFearlessLocks(series([]), { mode: 'per_team' })).toEqual([]);
  });

  it('accumulates each team’s own picks game after game across a Bo5', () => {
    const games = [game(1), game(2), game(3), game(4)];
    for (let played = 1; played <= 4; played += 1) {
      const locks = computeFearlessLocks(series(games.slice(0, played)), { mode: 'per_team' });
      const expectedA = Array.from({ length: played }, (_, g) =>
        range((g + 1) * 100 + 1, (g + 1) * 100 + 5),
      ).flat();
      const expectedB = Array.from({ length: played }, (_, g) =>
        range((g + 1) * 100 + 6, (g + 1) * 100 + 10),
      ).flat();
      expect(lockedChampions(locks, A)).toEqual(expectedA);
      expect(lockedChampions(locks, B)).toEqual(expectedB);
    }
    // Before game 5, each team has 20 champions it can no longer play.
    const beforeGame5 = computeFearlessLocks(series(games), { mode: 'per_team' });
    expect(lockedChampions(beforeGame5, A)).toHaveLength(20);
    expect(beforeGame5.find((l) => l.championId === 303)).toEqual({
      entrantId: A,
      championId: 303,
      lockedByGame: 3,
    });
  });

  it('ignores remade games and games without a draft', () => {
    const locks = computeFearlessLocks(
      series([
        game(1, 'remade'),
        game(2),
        { number: 3, status: 'forfeit', blue: A, red: B, winner: B },
      ]),
      { mode: 'per_team' },
    );
    expect(lockedChampions(locks, A)).toEqual(range(201, 205));
  });

  it('lets a team pick what the rival already played', () => {
    const locks = computeFearlessLocks(series([game(1)]), { mode: 'per_team' });
    expect(validateDraft(locks, [{ entrantId: A, championId: 106 }], [A, B])).toEqual({
      valid: true,
      violations: [],
    });
  });
});

describe('fearless locks (global variant)', () => {
  it('locks every champion played by either team for both', () => {
    const locks = computeFearlessLocks(series([game(1)]), { mode: 'global' });
    expect(lockedChampions(locks, A)).toEqual(range(101, 110));
    expect(lockedChampions(locks, B)).toEqual(range(101, 110));
    expect(validateDraft(locks, [{ entrantId: A, championId: 106 }], [A, B])).toMatchObject({
      valid: false,
    });
  });
});

describe('validateDraft', () => {
  const locks = computeFearlessLocks(series([game(1), game(2)]), { mode: 'per_team' });

  it('accepts a draft with fresh champions', () => {
    expect(validateDraft(locks, picksFor(3), [A, B]).valid).toBe(true);
  });

  it('reports every locked champion with the game that locked it', () => {
    const proposal = [
      ...picksFor(3).slice(0, 4),
      { entrantId: A, championId: 102 },
      { entrantId: B, championId: 207 },
    ];
    expect(validateDraft(locks, proposal, [A, B])).toEqual({
      valid: false,
      violations: [
        { reason: 'champion_locked', entrantId: A, championId: 102, lockedByGame: 1 },
        { reason: 'champion_locked', entrantId: B, championId: 207, lockedByGame: 2 },
      ],
    });
  });

  it('rejects the same champion twice in one draft and outsiders', () => {
    const proposal: DraftPick[] = [
      { entrantId: A, championId: 999 },
      { entrantId: B, championId: 999 },
      { entrantId: 'team-x', championId: 998 },
    ];
    expect(validateDraft([], proposal, [A, B]).violations).toEqual([
      { reason: 'duplicate_pick', entrantId: B, championId: 999 },
      { reason: 'unknown_entrant', entrantId: 'team-x', championId: 998 },
    ]);
  });
});
