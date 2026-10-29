import { describe, expect, it, vi } from 'vitest';

import { DataDragonChampionCatalog, StaticChampionCatalog } from './data-dragon.js';
import { normalizeMatchV5, type MatchV5Payload } from './match-v5.js';

const objective = (first: boolean, kills: number) => ({ first, kills });
const player = (puuid: string, teamId: 100 | 200, teamPosition: string) => ({
  puuid,
  teamId,
  championId: 103,
  teamPosition,
  kills: 4,
  deaths: 1,
  assists: 6,
  totalMinionsKilled: 200,
  neutralMinionsKilled: 20,
  goldEarned: 12_000,
  totalDamageDealtToChampions: 15_000,
  totalDamageTaken: 10_000,
  visionScore: 25,
  wardsPlaced: 9,
  wardsKilled: 3,
  firstBloodKill: false,
  doubleKills: 1,
  tripleKills: 0,
  quadraKills: 0,
  pentaKills: 0,
  turretKills: 2,
  dragonKills: 0,
  baronKills: 0,
  item0: 3089,
  item1: 0,
  item2: 3020,
  item3: 0,
  item4: 0,
  item5: 0,
  item6: 3340,
  perks: {
    styles: [
      { style: 8100, selections: [{ perk: 8112 }, { perk: 8139 }] },
      { style: 8300, selections: [{ perk: 8345 }] },
    ],
  },
  riotIdGameName: 'Ana',
  riotIdTagline: 'LAN',
});

const payload: MatchV5Payload = {
  metadata: { matchId: 'LA1_1' },
  info: {
    gameDuration: 1_745,
    gameVersion: '14.20.623.1234',
    gameEndTimestamp: 1_761_334_800_000,
    participants: [player('a', 100, 'MIDDLE'), player('b', 200, 'UTILITY'), player('c', 200, '')],
    teams: [
      {
        teamId: 200,
        win: false,
        bans: [
          { championId: 222, pickTurn: 7 },
          { championId: -1, pickTurn: 6 },
        ],
        objectives: {
          baron: objective(false, 0),
          dragon: objective(false, 1),
          horde: objective(false, 2),
          inhibitor: objective(false, 0),
          riftHerald: objective(false, 0),
          tower: objective(false, 3),
        },
      },
      {
        teamId: 100,
        win: true,
        bans: [
          { championId: 64, pickTurn: 3 },
          { championId: 157, pickTurn: 1 },
        ],
        objectives: {
          baron: objective(true, 1),
          dragon: objective(true, 3),
          horde: objective(true, 4),
          inhibitor: objective(true, 2),
          riftHerald: objective(true, 1),
          tower: objective(true, 9),
        },
      },
    ],
  },
};

describe('normalizeMatchV5', () => {
  it('maps sides, roles, cs, items and runes', () => {
    const match = normalizeMatchV5(payload);
    expect(match).toMatchObject({ matchId: 'LA1_1', durationSeconds: 1_745, patch: '14.20' });
    expect(match.endedAt?.toISOString()).toBe('2025-10-24T19:40:00.000Z');
    expect(match.participants.map((p) => [p.side, p.role])).toEqual([
      ['blue', 'mid'],
      ['red', 'support'],
      ['red', null],
    ]);
    expect(match.participants[0]).toMatchObject({
      cs: 220,
      riotId: 'Ana#LAN',
      items: [3089, 3020, 3340],
      runes: { keystone: 8112, primaryStyle: 8100, secondaryStyle: 8300 },
    });
  });

  it('orders the bans, drops the skipped ones and reads the objectives', () => {
    const blue = normalizeMatchV5(payload).teams.find((t) => t.side === 'blue');
    expect(blue).toMatchObject({
      win: true,
      bans: [
        { championId: 157, turn: 1 },
        { championId: 64, turn: 3 },
      ],
      towers: 9,
      dragons: 3,
      barons: 1,
      heralds: 1,
      grubs: 4,
      inhibitors: 2,
      firstTower: true,
    });
    expect(normalizeMatchV5(payload).teams.find((t) => t.side === 'red')?.bans).toEqual([
      { championId: 222, turn: 7 },
    ]);
  });

  it('tolerates a payload without version, end time, perks or Riot ID', () => {
    const bare = normalizeMatchV5({
      metadata: {},
      info: {
        ...payload.info,
        gameVersion: undefined,
        gameEndTimestamp: undefined,
        participants: [{ ...player('a', 100, 'TOP'), perks: undefined, riotIdTagline: undefined }],
      },
    });
    expect(bare).toMatchObject({ matchId: null, patch: null, endedAt: null });
    expect(bare.participants[0]).toMatchObject({
      riotId: null,
      runes: { keystone: null, primaryStyle: null, secondaryStyle: null },
    });
  });
});

const ddragon = (fail = false) =>
  vi.fn((url: string) => {
    if (fail) return Promise.resolve(new Response('down', { status: 503 }));
    if (url.endsWith('/api/versions.json'))
      return Promise.resolve(Response.json(['14.20.1', '14.19.1']));
    return Promise.resolve(
      Response.json({
        data: {
          MonkeyKing: { key: '62', id: 'MonkeyKing', name: 'Wukong' },
          Ahri: { key: '103', id: 'Ahri', name: 'Ahri' },
        },
      }),
    );
  });

describe('DataDragonChampionCatalog', () => {
  it('reads the latest version in es_MX, with icons, and caches it', async () => {
    const fetchFn = ddragon();
    const catalog = new DataDragonChampionCatalog({ fetch: fetchFn as unknown as typeof fetch });
    const map = await catalog.champions();
    expect(map.get(62)).toEqual({
      id: 62,
      name: 'Wukong',
      iconUrl: 'https://ddragon.leagueoflegends.com/cdn/14.20.1/img/champion/MonkeyKing.png',
    });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://ddragon.leagueoflegends.com/cdn/14.20.1/data/es_MX/champion.json',
      expect.anything(),
    );
    await catalog.champions();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('keeps the last catalog when a refresh fails, and retries later', async () => {
    let now = 0;
    let fail = false;
    const ok = ddragon();
    const down = ddragon(true);
    const catalog = new DataDragonChampionCatalog({
      fetch: ((url: string) => (fail ? down(url) : ok(url))) as unknown as typeof fetch,
      ttlMs: 1_000,
      retryMs: 100,
      now: () => now,
    });
    expect((await catalog.champions()).size).toBe(2);
    fail = true;
    now = 2_000;
    expect((await catalog.champions()).size).toBe(2);
    expect(down).toHaveBeenCalledTimes(1);
    now = 2_050;
    await catalog.champions();
    expect(down).toHaveBeenCalledTimes(1);
  });

  it('serves an empty catalog when Data Dragon was never reachable', async () => {
    const catalog = new DataDragonChampionCatalog({
      fetch: ddragon(true) as unknown as typeof fetch,
    });
    expect((await catalog.champions()).size).toBe(0);
  });
});

describe('StaticChampionCatalog', () => {
  it('names the demo champions, without icons', async () => {
    expect((await new StaticChampionCatalog().champions()).get(145)).toEqual({
      id: 145,
      name: "Kai'Sa",
      iconUrl: null,
    });
  });
});
