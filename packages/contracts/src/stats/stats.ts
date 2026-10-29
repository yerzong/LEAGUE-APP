import { z } from 'zod';

import { PlayerRoleSchema } from '../common/fields.js';
import { TeamRoleSchema } from '../teams/teams.js';

// Module 09: stats, pro profiles, MVPs, achievements and follows (docs/specs/m09).
const IsoDateTime = z.iso.datetime({ offset: true });
const Count = z.number().int().min(0);
const Ratio = z.number().min(0).max(1);
const Rate = z.number().min(0);

// ---------------------------------------------------------------------------
// Match data (Riot Match-V5). Only the fields the platform reads are
// validated; the rest of the payload is kept as it came.
// ---------------------------------------------------------------------------
const Stat = z.number().int().min(0).max(1_000_000);

export const MatchV5ParticipantSchema = z.looseObject({
  puuid: z.string().min(1).max(100),
  teamId: z.union([z.literal(100), z.literal(200)]),
  championId: z.number().int().positive(),
  teamPosition: z.string().max(20).default(''),
  kills: Stat,
  deaths: Stat,
  assists: Stat,
  totalMinionsKilled: Stat,
  neutralMinionsKilled: Stat.default(0),
  goldEarned: Stat,
  totalDamageDealtToChampions: Stat,
  totalDamageTaken: Stat.default(0),
  visionScore: Stat.default(0),
  wardsPlaced: Stat.default(0),
  wardsKilled: Stat.default(0),
  firstBloodKill: z.boolean().default(false),
  doubleKills: Stat.default(0),
  tripleKills: Stat.default(0),
  quadraKills: Stat.default(0),
  pentaKills: Stat.default(0),
  turretKills: Stat.default(0),
  dragonKills: Stat.default(0),
  baronKills: Stat.default(0),
  item0: Stat.default(0),
  item1: Stat.default(0),
  item2: Stat.default(0),
  item3: Stat.default(0),
  item4: Stat.default(0),
  item5: Stat.default(0),
  item6: Stat.default(0),
  perks: z
    .looseObject({
      styles: z.array(
        z.looseObject({
          style: z.number().int(),
          selections: z.array(z.looseObject({ perk: z.number().int() })),
        }),
      ),
    })
    .optional(),
  riotIdGameName: z.string().max(40).optional(),
  riotIdTagline: z.string().max(10).optional(),
});
export type MatchV5Participant = z.infer<typeof MatchV5ParticipantSchema>;

const Objective = z.looseObject({ first: z.boolean().default(false), kills: Stat.default(0) });
const NoObjective = { first: false, kills: 0 };

export const MatchV5TeamSchema = z.looseObject({
  teamId: z.union([z.literal(100), z.literal(200)]),
  win: z.boolean(),
  // Riot sends -1 for a skipped ban.
  bans: z
    .array(z.looseObject({ championId: z.number().int(), pickTurn: z.number().int() }))
    .default([]),
  objectives: z
    .looseObject({
      baron: Objective.default(NoObjective),
      champion: Objective.default(NoObjective),
      dragon: Objective.default(NoObjective),
      horde: Objective.default(NoObjective),
      inhibitor: Objective.default(NoObjective),
      riftHerald: Objective.default(NoObjective),
      tower: Objective.default(NoObjective),
    })
    .prefault({}),
});
export type MatchV5Team = z.infer<typeof MatchV5TeamSchema>;

export const MatchDataSchema = z.looseObject({
  metadata: z.looseObject({ matchId: z.string().max(40).optional() }).prefault({}),
  info: z.looseObject({
    /** Seconds. */
    gameDuration: z.number().int().positive().max(14_400),
    gameVersion: z.string().max(40).optional(),
    gameEndTimestamp: z.number().int().positive().optional(),
    participants: z.array(MatchV5ParticipantSchema).min(2).max(10),
    teams: z
      .array(MatchV5TeamSchema)
      .length(2)
      .refine((teams) => teams[0]?.teamId !== teams[1]?.teamId, 'one blue and one red team')
      .refine((teams) => teams.filter((t) => t.win).length === 1, 'exactly one team wins'),
  }),
});
export type MatchData = z.infer<typeof MatchDataSchema>;

export const AttachMatchDataRequestSchema = z.object({ data: MatchDataSchema });
export type AttachMatchDataRequest = z.infer<typeof AttachMatchDataRequestSchema>;

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------
/** A champion from Data Dragon (name and square icon). */
export const ChampionSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  iconUrl: z.url().nullable(),
});
export type Champion = z.infer<typeof ChampionSchema>;

export const RADAR_AXES = ['aggression', 'vision', 'farming', 'teamfight', 'survival'] as const;
const Axis = z.number().int().min(0).max(100);
export const RadarSchema = z.object({
  aggression: Axis,
  vision: Axis,
  farming: Axis,
  teamfight: Axis,
  survival: Axis,
});
export type Radar = z.infer<typeof RadarSchema>;

export const PlayerAggregateSchema = z.object({
  games: Count,
  wins: Count,
  kills: Count,
  deaths: Count,
  assists: Count,
  kda: Rate,
  avgCsPerMin: Rate,
  avgGoldPerMin: Rate,
  avgDamagePerMin: Rate,
  avgVisionPerMin: Rate,
  avgKillParticipation: Ratio,
  avgDamageShare: Ratio,
  avgScore: z.number(),
  mvps: Count,
  radar: RadarSchema,
});
export type PlayerAggregate = z.infer<typeof PlayerAggregateSchema>;

export const FormResultSchema = z.enum(['win', 'loss']);
export type FormResult = z.infer<typeof FormResultSchema>;

export const MvpScopeSchema = z.enum(['game', 'match', 'week', 'phase', 'tournament']);
export type MvpScope = z.infer<typeof MvpScopeSchema>;

export const AchievementIconSchema = z.enum([
  'trophy',
  'flame',
  'swords',
  'eye',
  'crown',
  'star',
  'target',
  'shield',
]);
export type AchievementIcon = z.infer<typeof AchievementIconSchema>;

const TournamentRef = z.object({ id: z.uuid(), slug: z.string(), name: z.string() });
export const PlayerRefSchema = z.object({
  username: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.url().nullable(),
});
export type PlayerRef = z.infer<typeof PlayerRefSchema>;

/** Whether the viewer follows it, and how many do (never who). */
export const FollowStateSchema = z.object({
  followers: Count,
  following: z.boolean(),
});
export type FollowState = z.infer<typeof FollowStateSchema>;

// ---------------------------------------------------------------------------
// Player profile
// ---------------------------------------------------------------------------
export const PlayerGameSummarySchema = z.object({
  champion: ChampionSchema,
  role: PlayerRoleSchema.nullable(),
  kills: Count,
  deaths: Count,
  assists: Count,
  csPerMin: Rate,
  isMvp: z.boolean(),
});

/** A played series: W/L and score always; the line only with match data. */
export const PlayerMatchSchema = z.object({
  matchId: z.uuid(),
  tournament: TournamentRef,
  playedAt: IsoDateTime,
  /** Null when the player hides their teams. */
  entrantName: z.string().nullable(),
  opponentName: z.string().nullable(),
  result: FormResultSchema,
  scoreFor: Count,
  scoreAgainst: Count,
  games: z.array(PlayerGameSummarySchema),
});
export type PlayerMatch = z.infer<typeof PlayerMatchSchema>;

export const PlayerChampionSchema = z.object({
  champion: ChampionSchema,
  games: Count,
  wins: Count,
  kills: Count,
  deaths: Count,
  assists: Count,
  kda: Rate,
});
export type PlayerChampion = z.infer<typeof PlayerChampionSchema>;

export const WeekPointSchema = z.object({
  weekStart: z.iso.date(),
  games: Count,
  wins: Count,
  kda: Rate,
  avgScore: z.number(),
});
export type WeekPoint = z.infer<typeof WeekPointSchema>;

export const EarnedAchievementSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  icon: AchievementIconSchema,
  awardedAt: IsoDateTime,
  tournament: TournamentRef.nullable(),
});
export type EarnedAchievement = z.infer<typeof EarnedAchievementSchema>;

export const MvpAwardSchema = z.object({
  scope: MvpScopeSchema,
  tournament: TournamentRef,
  /** For a week: its round number. */
  round: z.number().int().positive().nullable(),
  awardedAt: IsoDateTime,
});
export type MvpAward = z.infer<typeof MvpAwardSchema>;

export const PlayerStatsSchema = z.object({
  player: PlayerRefSchema,
  /** Series and games played, from the results (with or without match data). */
  record: z.object({ matches: Count, wins: Count, losses: Count }),
  form: z.array(FormResultSchema),
  /** All-time numbers; null while no game has match data. */
  overall: PlayerAggregateSchema.nullable(),
  tournaments: z.array(z.object({ tournament: TournamentRef, stats: PlayerAggregateSchema })),
  champions: z.array(PlayerChampionSchema),
  evolution: z.array(WeekPointSchema),
  achievements: z.array(EarnedAchievementSchema),
  mvps: z.array(MvpAwardSchema),
  history: z.array(PlayerMatchSchema),
  follow: FollowStateSchema,
});
export type PlayerStats = z.infer<typeof PlayerStatsSchema>;

export const HeadToHeadSchema = z.object({
  a: PlayerRefSchema,
  b: PlayerRefSchema,
  games: Count,
  winsA: Count,
  winsB: Count,
  statsA: PlayerAggregateSchema.nullable(),
  statsB: PlayerAggregateSchema.nullable(),
});
export type HeadToHead = z.infer<typeof HeadToHeadSchema>;

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------
export const TeamAggregateSchema = z.object({
  games: Count,
  wins: Count,
  avgDurationSeconds: Count,
  avgKills: Rate,
  avgTowers: Rate,
  avgDragons: Rate,
  avgBarons: Rate,
  firstBloodRate: Ratio,
  firstTowerRate: Ratio,
});
export type TeamAggregate = z.infer<typeof TeamAggregateSchema>;

export const TeamStatsSchema = z.object({
  record: z.object({ matches: Count, wins: Count, losses: Count }),
  form: z.array(FormResultSchema),
  overall: TeamAggregateSchema.nullable(),
  /** Members who show their teams publicly, with their numbers (null without match data). */
  roster: z.array(
    z.object({
      player: PlayerRefSchema,
      teamRole: TeamRoleSchema,
      stats: PlayerAggregateSchema.nullable(),
      topChampion: ChampionSchema.nullable(),
    }),
  ),
  follow: FollowStateSchema,
});
export type TeamStats = z.infer<typeof TeamStatsSchema>;

// ---------------------------------------------------------------------------
// Tournament
// ---------------------------------------------------------------------------
export const LEADER_STATS = ['kda', 'damagePerMin', 'csPerMin', 'visionPerMin', 'kills'] as const;
export const LeaderStatSchema = z.enum(LEADER_STATS);
export type LeaderStat = z.infer<typeof LeaderStatSchema>;

export const TournamentStatsSchema = z.object({
  /** Games with match data, and all completed games. */
  gamesWithData: Count,
  gamesPlayed: Count,
  leaders: z.array(
    z.object({
      stat: LeaderStatSchema,
      entries: z.array(z.object({ player: PlayerRefSchema, value: Rate, games: Count })),
    }),
  ),
  champions: z.array(
    z.object({
      champion: ChampionSchema,
      picks: Count,
      bans: Count,
      wins: Count,
      /** Of the games with match data, 0–1. */
      presence: Ratio,
    }),
  ),
  weeklyMvps: z.array(
    z.object({
      phaseName: z.string(),
      round: z.number().int().positive(),
      player: PlayerRefSchema,
      score: z.number(),
    }),
  ),
  mvp: z.object({ player: PlayerRefSchema, score: z.number(), games: Count }).nullable(),
  follow: FollowStateSchema,
});
export type TournamentStats = z.infer<typeof TournamentStatsSchema>;

// ---------------------------------------------------------------------------
// Match box score (public match page)
// ---------------------------------------------------------------------------
const BoxLine = z.object({
  player: PlayerRefSchema.nullable(),
  /** Riot ID shown when the account is not linked to a profile. */
  name: z.string(),
  champion: ChampionSchema,
  role: PlayerRoleSchema.nullable(),
  kills: Count,
  deaths: Count,
  assists: Count,
  cs: Count,
  gold: Count,
  damage: Count,
  visionScore: Count,
  isMvp: z.boolean(),
});

export const MatchStatsSchema = z.object({
  games: z.array(
    z.object({
      number: z.number().int().positive(),
      /** False: only the winner is known (manual result). */
      hasData: z.boolean(),
      durationSeconds: Count.nullable(),
      teams: z.array(
        z.object({
          entrantId: z.uuid(),
          side: z.enum(['blue', 'red']),
          win: z.boolean(),
          kills: Count,
          towers: Count,
          dragons: Count,
          barons: Count,
          bans: z.array(ChampionSchema),
          players: z.array(BoxLine),
        }),
      ),
    }),
  ),
});
export type MatchStats = z.infer<typeof MatchStatsSchema>;

// ---------------------------------------------------------------------------
// Follows
// ---------------------------------------------------------------------------
export const FollowableTypeSchema = z.enum(['team', 'user', 'tournament']);
export type FollowableType = z.infer<typeof FollowableTypeSchema>;

export const FollowRequestSchema = z.object({
  type: FollowableTypeSchema,
  /** Team or tournament slug, or username. */
  key: z
    .string()
    .toLowerCase()
    .regex(/^[a-z0-9_-]{2,64}$/),
});
export type FollowRequest = z.infer<typeof FollowRequestSchema>;

export const FollowItemSchema = z.object({
  type: FollowableTypeSchema,
  key: z.string(),
  name: z.string(),
  imageUrl: z.url().nullable(),
  href: z.string().startsWith('/'),
  followedAt: IsoDateTime,
});
export type FollowItem = z.infer<typeof FollowItemSchema>;
export const FollowListSchema = z.object({ items: z.array(FollowItemSchema) });
export type FollowList = z.infer<typeof FollowListSchema>;

// ---------------------------------------------------------------------------
// Achievement rules (admin): mirrors AchievementCriteria in packages/core
// ---------------------------------------------------------------------------
export const ACHIEVEMENT_GAME_STATS = [
  'kills',
  'deaths',
  'assists',
  'kda',
  'csPerMin',
  'visionScore',
  'damageShare',
  'killParticipation',
  'quadraKills',
  'pentaKills',
] as const;
export const ACHIEVEMENT_TOTAL_STATS = ['kills', 'assists', 'quadraKills', 'pentaKills'] as const;
const Threshold = z.number().min(0).max(100_000);

export const AchievementCriteriaSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('game'),
    conditions: z
      .array(
        z
          .object({
            stat: z.enum(ACHIEVEMENT_GAME_STATS),
            gte: Threshold.optional(),
            lte: Threshold.optional(),
          })
          .refine((c) => c.gte !== undefined || c.lte !== undefined, 'gte or lte'),
      )
      .min(1)
      .max(5),
  }),
  z.object({ type: z.literal('total'), stat: z.enum(ACHIEVEMENT_TOTAL_STATS), gte: Threshold }),
  z.object({
    type: z.literal('games'),
    gte: z.number().int().min(1).max(10_000),
    wins: z.boolean().optional(),
  }),
  z.object({ type: z.literal('win_streak'), gte: z.number().int().min(2).max(100) }),
  z.object({
    type: z.literal('mvp'),
    scope: MvpScopeSchema,
    gte: z.number().int().min(1).max(1000),
  }),
]);
export type AchievementCriteria = z.infer<typeof AchievementCriteriaSchema>;

export const AchievementSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]{3,40}$/),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().min(2).max(200),
  icon: AchievementIconSchema,
  criteria: AchievementCriteriaSchema,
  active: z.boolean(),
});
export type Achievement = z.infer<typeof AchievementSchema>;

export const AdminAchievementSchema = AchievementSchema.extend({
  /** Platform rule (shared) or this organization's own. */
  scope: z.enum(['platform', 'organization']),
  awarded: Count,
});
export type AdminAchievement = z.infer<typeof AdminAchievementSchema>;
export const AdminAchievementListSchema = z.object({ items: z.array(AdminAchievementSchema) });
export type AdminAchievementList = z.infer<typeof AdminAchievementListSchema>;

export const SaveAchievementRequestSchema = AchievementSchema.omit({ key: true });
export type SaveAchievementRequest = z.infer<typeof SaveAchievementRequestSchema>;

export const RecalculateStatsResponseSchema = z.object({ matches: Count });
export type RecalculateStatsResponse = z.infer<typeof RecalculateStatsResponseSchema>;
