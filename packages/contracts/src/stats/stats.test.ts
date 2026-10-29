import { describe, expect, it } from 'vitest';

import {
  AchievementCriteriaSchema,
  FollowRequestSchema,
  MatchDataSchema,
  SaveAchievementRequestSchema,
} from './stats.js';

const participant = (puuid: string, teamId: 100 | 200) => ({
  puuid,
  teamId,
  championId: 103,
  kills: 1,
  deaths: 2,
  assists: 3,
  totalMinionsKilled: 150,
  goldEarned: 9000,
  totalDamageDealtToChampions: 12000,
  challenges: { kda: 2 },
});
const match = (over: Record<string, unknown> = {}) => ({
  metadata: { matchId: 'LA1_123' },
  info: {
    gameDuration: 1800,
    participants: [participant('a', 100), participant('b', 200)],
    teams: [
      { teamId: 100, win: true, bans: [{ championId: -1, pickTurn: 1 }] },
      { teamId: 200, win: false },
    ],
    ...over,
  },
});

describe('match data (Match-V5)', () => {
  it('fills the optional numbers and keeps the fields it does not read', () => {
    const data = MatchDataSchema.parse(match());
    const first = data.info.participants[0];
    expect(first).toMatchObject({ visionScore: 0, pentaKills: 0, item6: 0, teamPosition: '' });
    expect(first?.['challenges']).toEqual({ kda: 2 });
    expect(data.info.teams[1]?.objectives.baron).toEqual({ first: false, kills: 0 });
  });

  it('needs one blue and one red team and exactly one winner', () => {
    expect(
      MatchDataSchema.safeParse(
        match({
          teams: [
            { teamId: 100, win: true },
            { teamId: 100, win: false },
          ],
        }),
      ).success,
    ).toBe(false);
    expect(
      MatchDataSchema.safeParse(
        match({
          teams: [
            { teamId: 100, win: true },
            { teamId: 200, win: true },
          ],
        }),
      ).success,
    ).toBe(false);
    expect(MatchDataSchema.safeParse(match({ gameDuration: 0 })).success).toBe(false);
  });
});

describe('achievement rules', () => {
  it('accepts each kind of rule', () => {
    for (const criteria of [
      { type: 'game', conditions: [{ stat: 'pentaKills', gte: 1 }] },
      { type: 'total', stat: 'kills', gte: 100 },
      { type: 'games', gte: 10, wins: true },
      { type: 'win_streak', gte: 3 },
      { type: 'mvp', scope: 'week', gte: 1 },
    ])
      expect(AchievementCriteriaSchema.safeParse(criteria).success).toBe(true);
  });

  it('rejects a condition without a threshold or an unknown stat', () => {
    expect(
      AchievementCriteriaSchema.safeParse({ type: 'game', conditions: [{ stat: 'kills' }] })
        .success,
    ).toBe(false);
    expect(
      AchievementCriteriaSchema.safeParse({ type: 'total', stat: 'gold', gte: 1 }).success,
    ).toBe(false);
    expect(
      SaveAchievementRequestSchema.safeParse({
        name: 'X',
        description: 'Una regla',
        icon: 'trophy',
        criteria: { type: 'win_streak', gte: 1 },
        active: true,
      }).success,
    ).toBe(false);
  });
});

describe('follow request', () => {
  it('normalizes the key and rejects anything else', () => {
    expect(FollowRequestSchema.parse({ type: 'team', key: 'Demo-Jaguares' })).toEqual({
      type: 'team',
      key: 'demo-jaguares',
    });
    expect(FollowRequestSchema.safeParse({ type: 'organization', key: 'x1' }).success).toBe(false);
    expect(FollowRequestSchema.safeParse({ type: 'user', key: 'a b' }).success).toBe(false);
  });
});
