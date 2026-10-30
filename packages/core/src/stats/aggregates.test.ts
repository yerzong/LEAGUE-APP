import { describe, expect, it } from 'vitest';

import { game, participant } from '../__fixtures__/stats.js';
import {
  aggregatePlayer,
  aggregateTeam,
  championMeta,
  championStats,
  computeRadar,
  headToHead,
  RADAR_AXES,
  recentForm,
  weeklyEvolution,
  type HistoryLine,
} from './aggregates.js';
import { deriveGameStats } from './game-stats.js';

/** The fixture game played on `day`, as the history of every participant. */
function played(gameId: string, day: string, replace?: Parameters<typeof game>[0]) {
  const stats = deriveGameStats(game(replace));
  return {
    players: stats.players.map((l): HistoryLine => ({
      ...l,
      gameId,
      playedAt: `${day}T20:00:00.000Z`,
    })),
    teams: stats.teams,
  };
}
const linesOf = (puuid: string, ...games: ReturnType<typeof played>[]) =>
  games.flatMap((g) => g.players.filter((l) => l.puuid === puuid));

describe('computeRadar', () => {
  const pro = {
    minutes: 30,
    kills: 9,
    assists: 6,
    deaths: 0,
    damagePerMin: 900,
    visionPerMin: 3,
    csPerMin: 10,
    killParticipation: 0.8,
    damageShare: 0.35,
  };

  it('maps each axis to 0–100 against fixed reference ranges', () => {
    expect(computeRadar(pro)).toEqual({
      aggression: 100,
      vision: 100,
      farming: 100,
      teamfight: 100,
      survival: 100,
    });
    expect(
      computeRadar({
        minutes: 30,
        kills: 0,
        assists: 0,
        deaths: 9,
        damagePerMin: 100,
        visionPerMin: 0.2,
        csPerMin: 1,
        killParticipation: 0.1,
        damageShare: 0.05,
      }),
    ).toEqual({ aggression: 0, vision: 0, farming: 0, teamfight: 0, survival: 0 });
  });

  it('is pure: the same data gives the same radar, as integers in range', () => {
    const mid = aggregatePlayer(linesOf('blue-mid', played('g1', '2026-10-03')));
    const again = aggregatePlayer(linesOf('blue-mid', played('g1', '2026-10-03')));
    expect(mid?.radar).toEqual(again?.radar);
    for (const axis of RADAR_AXES) {
      const value = mid?.radar[axis] ?? -1;
      expect(Number.isInteger(value) && value >= 0 && value <= 100).toBe(true);
    }
  });

  it('a better farmer scores higher on farming, a feeder lower on survival', () => {
    const base = { ...pro, csPerMin: 6, deaths: 3 };
    expect(computeRadar({ ...base, csPerMin: 8 }).farming).toBeGreaterThan(
      computeRadar(base).farming,
    );
    expect(computeRadar({ ...base, deaths: 6 }).survival).toBeLessThan(computeRadar(base).survival);
  });
});

describe('aggregatePlayer', () => {
  it('sums the games and averages the rates over the time played', () => {
    const g1 = played('g1', '2026-10-03');
    // A 15-minute stomp in the second game.
    const short = game();
    const g2 = {
      players: deriveGameStats({ ...short, durationSeconds: 900 }).players.map(
        (l): HistoryLine => ({ ...l, gameId: 'g2', playedAt: '2026-10-10T20:00:00.000Z' }),
      ),
    };
    const mid = aggregatePlayer([
      ...linesOf('blue-mid', g1),
      ...g2.players.filter((l) => l.puuid === 'blue-mid'),
    ]);
    expect(mid).toMatchObject({
      games: 2,
      wins: 2,
      kills: 16,
      deaths: 4,
      assists: 12,
      kda: 7,
      // 540 cs over 45 minutes.
      avgCsPerMin: 12,
      avgKillParticipation: 0.7,
      avgDamageShare: 0.3,
      mvps: 2,
    });
  });

  it('is null without games', () => {
    expect(aggregatePlayer([])).toBeNull();
  });
});

describe('championStats', () => {
  it('groups by champion with wins and KDA, most played first', () => {
    const lines = [
      ...linesOf('blue-mid', played('g1', '2026-10-03'), played('g2', '2026-10-10')),
      ...linesOf('red-mid', played('g3', '2026-10-17')).map((l) => ({ ...l, puuid: 'blue-mid' })),
    ];
    expect(championStats(lines)).toEqual([
      { championId: 102, games: 2, wins: 2, kills: 16, deaths: 4, assists: 12, kda: 7 },
      { championId: 202, games: 1, wins: 0, kills: 3, deaths: 4, assists: 3, kda: 1.5 },
    ]);
  });
});

describe('aggregateTeam', () => {
  it('averages the team lines and rates the firsts', () => {
    const lines = [
      ...played('g1', '2026-10-03').teams.filter((t) => t.side === 'blue'),
      ...played('g2', '2026-10-10').teams.filter((t) => t.side === 'red'),
    ];
    expect(aggregateTeam(lines)).toEqual({
      games: 2,
      wins: 1,
      avgDurationSeconds: 1_800,
      avgKills: 15,
      avgTowers: 6,
      avgDragons: 2,
      avgBarons: 0.5,
      firstBloodRate: 0.5,
      firstTowerRate: 0.5,
    });
    expect(aggregateTeam([])).toBeNull();
  });
});

describe('championMeta', () => {
  it('counts picks, bans and wins, ordered by presence', () => {
    expect(
      championMeta({
        picks: [
          { championId: 1, win: true },
          { championId: 1, win: false },
          { championId: 2, win: true },
        ],
        bans: [3, 3, 1],
      }),
    ).toEqual([
      { championId: 1, picks: 2, bans: 1, wins: 1 },
      { championId: 3, picks: 0, bans: 2, wins: 0 },
      { championId: 2, picks: 1, bans: 0, wins: 1 },
    ]);
  });
});

describe('weeklyEvolution', () => {
  it('buckets the games by week (Monday, UTC), oldest first', () => {
    const lines = linesOf(
      'blue-mid',
      played('g2', '2026-10-10'), // Saturday of the week of Oct 5
      played('g1', '2026-10-05'),
      played('g3', '2026-10-12', { blue: [participant('blue-mid', { deaths: 7 })] }),
    );
    const weeks = weeklyEvolution(lines);
    expect(weeks.map(({ avgScore: _, ...w }) => w)).toEqual([
      { weekStart: '2026-10-05', games: 2, wins: 2, kda: 7 },
      { weekStart: '2026-10-12', games: 1, wins: 1, kda: 2 },
    ]);
    // More deaths, lower score.
    expect(weeks[1]?.avgScore).toBeLessThan(weeks[0]?.avgScore ?? 0);
  });
});

describe('recentForm and headToHead', () => {
  it('lists the last results, newest first', () => {
    expect(
      recentForm(
        [
          { win: true, playedAt: '2026-10-03T20:00:00Z' },
          { win: false, playedAt: '2026-10-17T20:00:00Z' },
          { win: true, playedAt: '2026-10-10T20:00:00Z' },
        ],
        2,
      ),
    ).toEqual(['loss', 'win']);
  });

  it('compares two players over the games they played against each other', () => {
    const g1 = played('g1', '2026-10-03');
    const g2 = played('g2', '2026-10-10');
    const a = linesOf('blue-mid', g1, g2);
    // In g2 the other player was on the same side: not a head-to-head game.
    const b = [...linesOf('red-mid', g1), ...linesOf('blue-top', g2)];
    const h2h = headToHead(a, b);
    expect(h2h).toMatchObject({ games: 1, winsA: 1, winsB: 0 });
    expect(h2h.a?.kills).toBe(8);
    expect(h2h.b?.kills).toBe(3);
    expect(headToHead(a, [])).toEqual({ games: 0, winsA: 0, winsB: 0, a: null, b: null });
  });
});
