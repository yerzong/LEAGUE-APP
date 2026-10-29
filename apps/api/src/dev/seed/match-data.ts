// Fictional Match-V5 payloads for the demo league (docs/specs/m09): what Riot
// would send for a game, so the profiles have radar, champions and MVPs
// without depending on Riot. Deterministic: the same key gives the same game.

const ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as const;
type Position = (typeof ROLES)[number];

/** Real champion ids (Data Dragon) by the role they are usually played in. */
const POOL: Record<Position, readonly number[]> = {
  TOP: [266, 122, 86, 24, 164, 897, 58, 54],
  JUNGLE: [64, 104, 254, 234, 113, 59, 57],
  MIDDLE: [103, 84, 61, 134, 157, 238, 268, 99],
  BOTTOM: [22, 51, 81, 222, 145, 110, 498],
  UTILITY: [89, 111, 412, 526, 117, 43, 201],
};
const ITEMS = [3031, 3006, 3089, 3020, 3071, 6672, 3046, 3065, 3190, 3157, 6653, 3074, 3110];
const KEYSTONES: Record<Position, readonly [number, number]> = {
  TOP: [8010, 8000],
  JUNGLE: [8128, 8100],
  MIDDLE: [8112, 8100],
  BOTTOM: [8008, 8000],
  UTILITY: [8439, 8400],
};
const PER_MIN: Record<Position, { cs: number; damage: number; vision: number }> = {
  TOP: { cs: 7.4, damage: 560, vision: 0.8 },
  JUNGLE: { cs: 5.8, damage: 420, vision: 1.2 },
  MIDDLE: { cs: 8.1, damage: 660, vision: 0.9 },
  BOTTOM: { cs: 8.6, damage: 700, vision: 0.7 },
  UTILITY: { cs: 1.2, damage: 260, vision: 2.4 },
};
const KILL_WEIGHT: Record<Position, number> = {
  TOP: 0.2,
  JUNGLE: 0.18,
  MIDDLE: 0.27,
  BOTTOM: 0.3,
  UTILITY: 0.05,
};

/** mulberry32 seeded with a string hash. */
function random(key: string): () => number {
  let h = 1779033703 ^ key.length;
  for (let i = 0; i < key.length; i += 1) {
    h = Math.imul(h ^ key.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoGameInput {
  /** Seed of the game (the same key, the same game). */
  readonly key: string;
  /** PUUIDs in role order: top, jungle, mid, adc, support. */
  readonly blue: readonly string[];
  readonly red: readonly string[];
  readonly blueWins: boolean;
  readonly endedAt: Date;
  /** Riot IDs shown for the PUUIDs, when known. */
  readonly riotIds?: ReadonlyMap<string, { gameName: string; tagLine: string }>;
  /** A player who closes the game with a pentakill. */
  readonly pentakill?: string;
}

export function demoMatchData(input: DemoGameInput) {
  const rnd = random(input.key);
  const between = (low: number, high: number) => low + (high - low) * rnd();
  const int = (low: number, high: number) => Math.floor(between(low, high + 1));
  const pick = <T>(list: readonly T[]) => list[Math.floor(rnd() * list.length)] as T;
  const minutes = int(24, 38);
  const used = new Set<number>();
  const champion = (role: Position) => {
    const free = POOL[role].filter((c) => !used.has(c));
    const id = pick(free.length > 0 ? free : POOL[role]);
    used.add(id);
    return id;
  };

  const sides = [
    { teamId: 100 as const, puuids: input.blue, win: input.blueWins },
    { teamId: 200 as const, puuids: input.red, win: !input.blueWins },
  ];
  const kills = sides.map((s) => (s.win ? int(16, 30) : int(6, 17)));
  // Each team's deaths are the other team's kills.
  const spread = (total: number, weights: readonly number[]) => {
    const sum = weights.reduce((a, b) => a + b, 0);
    const out = weights.map((w) => Math.floor((total * w) / sum));
    for (let left = total - out.reduce((a, b) => a + b, 0); left > 0; left -= 1) {
      const i = int(0, 4);
      out[i] = (out[i] ?? 0) + 1;
    }
    return out;
  };
  const firstBloodSide = rnd() < 0.7 ? (input.blueWins ? 0 : 1) : input.blueWins ? 1 : 0;
  const firstBloodRole = int(0, 3);
  // Which side took each first objective (index 0 = blue).
  const firstOf = (favored: number) => (rnd() < 0.7 ? favored : 1 - favored);
  const winnerIndex = input.blueWins ? 0 : 1;
  const firstTower = firstOf(winnerIndex);
  const firstDragon = firstOf(winnerIndex);

  const participants = sides.flatMap((side, s) => {
    const teamKills = kills[s] ?? 0;
    const enemyKills = kills[1 - s] ?? 0;
    const k = spread(
      teamKills,
      ROLES.map((r) => KILL_WEIGHT[r] * between(0.6, 1.4)),
    );
    const d = spread(
      enemyKills,
      ROLES.map(() => between(0.6, 1.4)),
    );
    return ROLES.map((role, r) => {
      const puuid = side.puuids[r] ?? `${input.key}-${String(side.teamId)}-${String(r)}`;
      const per = PER_MIN[role];
      const own = k[r] ?? 0;
      const assists = Math.max(
        0,
        Math.round((teamKills - own) * between(role === 'UTILITY' ? 0.55 : 0.3, 0.75)),
      );
      const penta = input.pentakill === puuid;
      const vision = Math.round(per.vision * minutes * between(0.8, 1.25));
      const riotId = input.riotIds?.get(puuid);
      const [keystone, primary] = KEYSTONES[role];
      const items = Array.from({ length: 6 }, () => pick(ITEMS));
      return {
        puuid,
        teamId: side.teamId,
        championId: champion(role),
        teamPosition: role,
        kills: penta ? Math.max(own, 7) : own,
        deaths: d[r] ?? 0,
        assists,
        totalMinionsKilled: Math.round(per.cs * minutes * between(0.85, 1.15)),
        neutralMinionsKilled: role === 'JUNGLE' ? int(90, 160) : int(0, 12),
        goldEarned: Math.round(minutes * between(330, 430) + (side.win ? 1500 : 0)),
        totalDamageDealtToChampions: Math.round(per.damage * minutes * between(0.75, 1.3)),
        totalDamageTaken: Math.round(minutes * between(450, 900)),
        visionScore: vision,
        wardsPlaced: Math.round(vision * between(0.35, 0.5)),
        wardsKilled: Math.round(vision * between(0.05, 0.15)),
        firstBloodKill: s === firstBloodSide && r === firstBloodRole,
        doubleKills: own >= 4 ? int(0, 2) : 0,
        tripleKills: own >= 7 ? int(0, 1) : 0,
        quadraKills: penta ? 1 : 0,
        pentaKills: penta ? 1 : 0,
        turretKills: role === 'UTILITY' ? 0 : int(0, side.win ? 3 : 1),
        dragonKills: role === 'JUNGLE' ? int(side.win ? 1 : 0, side.win ? 3 : 1) : 0,
        baronKills: role === 'JUNGLE' && side.win ? int(0, 1) : 0,
        item0: items[0] ?? 0,
        item1: items[1] ?? 0,
        item2: items[2] ?? 0,
        item3: items[3] ?? 0,
        item4: items[4] ?? 0,
        item5: items[5] ?? 0,
        item6: 3340,
        perks: {
          styles: [
            { style: primary, selections: [{ perk: keystone }] },
            { style: primary === 8000 ? 8300 : 8000, selections: [{ perk: 8345 }] },
          ],
        },
        ...(riotId ? { riotIdGameName: riotId.gameName, riotIdTagline: riotId.tagLine } : {}),
      };
    });
  });

  const bannable = Object.values(POOL)
    .flat()
    .filter((c) => !used.has(c));
  const bans = Array.from({ length: 10 }, (_, i) => {
    const id = pick(bannable.filter((c) => !used.has(c)));
    used.add(id);
    return { championId: id, pickTurn: i + 1 };
  });

  return {
    metadata: { matchId: `DEMO_${input.key.replace(/[^A-Za-z0-9]/g, '').slice(-24)}` },
    info: {
      gameDuration: minutes * 60 + int(0, 59),
      gameVersion: '15.21.715.2108',
      gameEndTimestamp: input.endedAt.getTime(),
      participants,
      teams: sides.map((side, s) => {
        const first = s === firstBloodSide;
        return {
          teamId: side.teamId,
          win: side.win,
          bans: bans.filter((_, i) => i % 2 === s),
          objectives: {
            baron: { first: side.win, kills: side.win ? int(1, 2) : 0 },
            champion: { first, kills: kills[s] ?? 0 },
            dragon: { first: s === firstDragon, kills: side.win ? int(2, 4) : int(0, 2) },
            horde: { first: side.win, kills: side.win ? int(3, 6) : int(0, 3) },
            inhibitor: { first: side.win, kills: side.win ? int(1, 3) : 0 },
            riftHerald: { first: side.win, kills: side.win ? 1 : 0 },
            tower: { first: s === firstTower, kills: side.win ? int(7, 11) : int(1, 5) },
          },
        };
      }),
    },
  };
}
