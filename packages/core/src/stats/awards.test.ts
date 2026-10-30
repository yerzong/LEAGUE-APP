import { describe, expect, it } from 'vitest';

import { evaluateAchievements, pickMvp, type AchievementDef, type AwardLine } from './awards.js';

const line = (gameId: string, day: number, over: Partial<AwardLine> = {}): AwardLine => ({
  gameId,
  playedAt: `2026-10-${String(day).padStart(2, '0')}T20:00:00.000Z`,
  win: true,
  kills: 5,
  deaths: 2,
  assists: 5,
  kda: 5,
  csPerMin: 7,
  visionScore: 30,
  damageShare: 0.25,
  killParticipation: 0.6,
  quadraKills: 0,
  pentaKills: 0,
  ...over,
});

describe('pickMvp', () => {
  it('takes the best average score, then more games, then the lowest id', () => {
    expect(
      pickMvp([
        { userId: 'b', score: 40 },
        { userId: 'a', score: 30 },
        { userId: 'a', score: 50 },
        { userId: 'c', score: 40 },
      ]),
    ).toEqual({ userId: 'a', score: 40, games: 2 });
    expect(
      pickMvp([
        { userId: 'c', score: 40 },
        { userId: 'b', score: 40 },
      ])?.userId,
    ).toBe('b');
  });

  it('ignores unlinked players and needs a minimum of games', () => {
    expect(pickMvp([{ userId: null, score: 99 }])).toBeNull();
    expect(
      pickMvp(
        [
          { userId: 'a', score: 90 },
          { userId: 'b', score: 40 },
          { userId: 'b', score: 40 },
        ],
        { minGames: 2 },
      )?.userId,
    ).toBe('b');
  });
});

describe('evaluateAchievements', () => {
  const defs: AchievementDef[] = [
    { id: 'first-win', criteria: { type: 'games', gte: 1, wins: true } },
    { id: 'penta', criteria: { type: 'game', conditions: [{ stat: 'pentaKills', gte: 1 }] } },
    {
      id: 'perfect',
      criteria: {
        type: 'game',
        conditions: [
          { stat: 'deaths', lte: 0 },
          { stat: 'kills', gte: 5 },
        ],
      },
    },
    { id: 'streak-3', criteria: { type: 'win_streak', gte: 3 } },
    { id: 'killer', criteria: { type: 'total', stat: 'kills', gte: 12 } },
    { id: 'mvp-week', criteria: { type: 'mvp', scope: 'week', gte: 1 } },
  ];

  it('awards what the history earns, with the game that earned it', () => {
    const lines = [
      line('g1', 3, { win: false }),
      line('g2', 4, { pentaKills: 1 }),
      line('g3', 5, { deaths: 0 }),
      line('g4', 6),
    ];
    expect(evaluateAchievements(defs, { lines, mvps: [] }, new Set())).toEqual([
      { achievementId: 'first-win', context: { gameId: 'g2' } },
      { achievementId: 'penta', context: { gameId: 'g2' } },
      { achievementId: 'perfect', context: { gameId: 'g3' } },
      { achievementId: 'streak-3', context: { gameId: 'g4', value: 3 } },
      { achievementId: 'killer', context: { gameId: 'g3', value: 15 } },
    ]);
  });

  it('a streak breaks with a loss, in the order the games were played', () => {
    const lines = [line('g3', 5), line('g1', 3), line('g2', 4, { win: false }), line('g4', 6)];
    expect(
      evaluateAchievements([defs[3] as AchievementDef], { lines, mvps: [] }, new Set()),
    ).toEqual([]);
  });

  it('counts MVP awards by scope', () => {
    const history = { lines: [], mvps: [{ scope: 'game' as const }, { scope: 'week' as const }] };
    expect(evaluateAchievements(defs, history, new Set())).toEqual([
      { achievementId: 'mvp-week', context: { value: 1 } },
    ]);
  });

  it('is idempotent: what is already awarded is not awarded again', () => {
    const lines = [line('g1', 3)];
    expect(evaluateAchievements(defs, { lines, mvps: [] }, new Set(['first-win']))).toEqual([]);
  });
});
