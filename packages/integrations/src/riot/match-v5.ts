// Match-V5 → the platform's game shape (docs/06). The payload arrives already
// validated (packages/contracts MatchDataSchema); this only renames and
// reshapes. The Riot match adapter of m08 reuses it after fetching.

export type NormalizedRole = 'top' | 'jungle' | 'mid' | 'adc' | 'support';
export type NormalizedSide = 'blue' | 'red';

interface Objective {
  readonly first: boolean;
  readonly kills: number;
}

/** The part of a Match-V5 match the platform reads. */
export interface MatchV5Payload {
  readonly metadata: { readonly matchId?: string | undefined };
  readonly info: {
    readonly gameDuration: number;
    readonly gameVersion?: string | undefined;
    readonly gameEndTimestamp?: number | undefined;
    readonly participants: readonly {
      readonly puuid: string;
      readonly teamId: 100 | 200;
      readonly championId: number;
      readonly teamPosition: string;
      readonly kills: number;
      readonly deaths: number;
      readonly assists: number;
      readonly totalMinionsKilled: number;
      readonly neutralMinionsKilled: number;
      readonly goldEarned: number;
      readonly totalDamageDealtToChampions: number;
      readonly totalDamageTaken: number;
      readonly visionScore: number;
      readonly wardsPlaced: number;
      readonly wardsKilled: number;
      readonly firstBloodKill: boolean;
      readonly doubleKills: number;
      readonly tripleKills: number;
      readonly quadraKills: number;
      readonly pentaKills: number;
      readonly turretKills: number;
      readonly dragonKills: number;
      readonly baronKills: number;
      readonly item0: number;
      readonly item1: number;
      readonly item2: number;
      readonly item3: number;
      readonly item4: number;
      readonly item5: number;
      readonly item6: number;
      readonly perks?:
        | {
            readonly styles: readonly {
              readonly style: number;
              readonly selections: readonly { readonly perk: number }[];
            }[];
          }
        | undefined;
      readonly riotIdGameName?: string | undefined;
      readonly riotIdTagline?: string | undefined;
    }[];
    readonly teams: readonly {
      readonly teamId: 100 | 200;
      readonly win: boolean;
      readonly bans: readonly { readonly championId: number; readonly pickTurn: number }[];
      readonly objectives: {
        readonly baron: Objective;
        readonly dragon: Objective;
        readonly horde: Objective;
        readonly inhibitor: Objective;
        readonly riftHerald: Objective;
        readonly tower: Objective;
      };
    }[];
  };
}

export interface NormalizedParticipant {
  readonly puuid: string;
  readonly side: NormalizedSide;
  readonly championId: number;
  readonly role: NormalizedRole | null;
  /** `gameName#tagLine` when the payload has it. */
  readonly riotId: string | null;
  readonly kills: number;
  readonly deaths: number;
  readonly assists: number;
  readonly cs: number;
  readonly gold: number;
  readonly damageToChampions: number;
  readonly damageTaken: number;
  readonly visionScore: number;
  readonly wardsPlaced: number;
  readonly wardsKilled: number;
  readonly firstBloodKill: boolean;
  readonly doubleKills: number;
  readonly tripleKills: number;
  readonly quadraKills: number;
  readonly pentaKills: number;
  readonly turretKills: number;
  readonly dragonKills: number;
  readonly baronKills: number;
  readonly items: readonly number[];
  readonly runes: {
    readonly keystone: number | null;
    readonly primaryStyle: number | null;
    readonly secondaryStyle: number | null;
  };
}

export interface NormalizedTeam {
  readonly side: NormalizedSide;
  readonly win: boolean;
  /** In ban order; skipped bans removed. */
  readonly bans: readonly { readonly championId: number; readonly turn: number }[];
  readonly towers: number;
  readonly dragons: number;
  readonly barons: number;
  readonly heralds: number;
  readonly grubs: number;
  readonly inhibitors: number;
  readonly firstTower: boolean;
  readonly firstDragon: boolean;
  readonly firstBaron: boolean;
}

export interface NormalizedMatch {
  readonly matchId: string | null;
  readonly durationSeconds: number;
  /** `14.20` from the game version. */
  readonly patch: string | null;
  readonly endedAt: Date | null;
  readonly teams: readonly NormalizedTeam[];
  readonly participants: readonly NormalizedParticipant[];
}

const ROLES: Readonly<Record<string, NormalizedRole>> = {
  TOP: 'top',
  JUNGLE: 'jungle',
  MIDDLE: 'mid',
  BOTTOM: 'adc',
  UTILITY: 'support',
};

const sideOf = (teamId: 100 | 200): NormalizedSide => (teamId === 100 ? 'blue' : 'red');

export function normalizeMatchV5(payload: MatchV5Payload): NormalizedMatch {
  const { info } = payload;
  const patch = info.gameVersion?.split('.').slice(0, 2).join('.') ?? null;
  return {
    matchId: payload.metadata.matchId ?? null,
    durationSeconds: info.gameDuration,
    patch: patch && /^\d+\.\d+$/.test(patch) ? patch : null,
    endedAt: info.gameEndTimestamp ? new Date(info.gameEndTimestamp) : null,
    teams: info.teams.map((t) => ({
      side: sideOf(t.teamId),
      win: t.win,
      bans: t.bans
        .filter((b) => b.championId > 0)
        .sort((a, b) => a.pickTurn - b.pickTurn)
        .map((b) => ({ championId: b.championId, turn: b.pickTurn })),
      towers: t.objectives.tower.kills,
      dragons: t.objectives.dragon.kills,
      barons: t.objectives.baron.kills,
      heralds: t.objectives.riftHerald.kills,
      grubs: t.objectives.horde.kills,
      inhibitors: t.objectives.inhibitor.kills,
      firstTower: t.objectives.tower.first,
      firstDragon: t.objectives.dragon.first,
      firstBaron: t.objectives.baron.first,
    })),
    participants: info.participants.map((p) => {
      const [primary, secondary] = p.perks?.styles ?? [];
      return {
        puuid: p.puuid,
        side: sideOf(p.teamId),
        championId: p.championId,
        role: ROLES[p.teamPosition] ?? null,
        riotId:
          p.riotIdGameName && p.riotIdTagline ? `${p.riotIdGameName}#${p.riotIdTagline}` : null,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        cs: p.totalMinionsKilled + p.neutralMinionsKilled,
        gold: p.goldEarned,
        damageToChampions: p.totalDamageDealtToChampions,
        damageTaken: p.totalDamageTaken,
        visionScore: p.visionScore,
        wardsPlaced: p.wardsPlaced,
        wardsKilled: p.wardsKilled,
        firstBloodKill: p.firstBloodKill,
        doubleKills: p.doubleKills,
        tripleKills: p.tripleKills,
        quadraKills: p.quadraKills,
        pentaKills: p.pentaKills,
        turretKills: p.turretKills,
        dragonKills: p.dragonKills,
        baronKills: p.baronKills,
        items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6].filter((i) => i > 0),
        runes: {
          keystone: primary?.selections[0]?.perk ?? null,
          primaryStyle: primary?.style ?? null,
          secondaryStyle: secondary?.style ?? null,
        },
      };
    }),
  };
}
