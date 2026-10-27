// The tournament configuration the wizard edits (docs/14 §3.1), also stored
// whole as a template. Each top-level key is a section of the edit policy in
// packages/core (TOURNAMENT_SECTIONS). Drafts are saved complete: the wizard
// starts from DEFAULT_TOURNAMENT_CONFIG, so a draft is structurally valid at
// any step; what a tournament still needs to publish is checked by the API.

import { z } from 'zod';

import { CountryCodeSchema, GameRegionSchema, optionalText } from '../common/fields.js';
import { GenderSchema } from '../profile/profile.js';
import { RankTierSchema } from '../riot/riot.js';

export const TOURNAMENT_CONFIG_VERSION = 1;

export const TournamentTypeSchema = z.enum([
  'league',
  'flash',
  'womens',
  'university',
  'ranked_tier',
  'custom',
]);
export const TournamentStatusSchema = z.enum([
  'draft',
  'published',
  'registration_open',
  'registration_closed',
  'seeding',
  'in_progress',
  'completed',
  'canceled',
  'archived',
]);
export const TournamentVisibilitySchema = z.enum(['public', 'unlisted', 'private']);
export const TierSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export const EntrantKindSchema = z.enum(['team', 'solo']);
export const TeamSourceSchema = z.enum(['permanent_only', 'ad_hoc_allowed', 'ad_hoc_only']);
export const ParticipantPolicySchema = z.enum(['independent_only', 'clubs_only', 'mixed']);
export const ModalitySchema = z.enum(['online', 'onsite', 'hybrid']);
export const ExclusivityScopeSchema = z.enum(['none', 'tournament', 'circuit', 'season']);
export const SupervisionLevelSchema = z.enum(['automatic', 'dual_report', 'referee', 'broadcast']);
export const CostreamPolicySchema = z.enum([
  'disabled',
  'registered_creators',
  'approval_required',
]);
export const GameMapSchema = z.enum(['summoners_rift', 'howling_abyss']);
export const PickTypeSchema = z.enum([
  'tournament_draft',
  'blind_pick',
  'draft_mode',
  'all_random',
]);
export const SpectatorTypeSchema = z.enum(['none', 'lobbyonly', 'all']);
/** The formats packages/core implements (`createFormatRegistry`). */
export const PhaseFormatSchema = z.enum([
  'single_elimination',
  'double_elimination',
  'round_robin',
  'double_round_robin',
  'groups',
  'swiss',
]);
export const SeriesFormatSchema = z.enum(['bo1', 'bo3', 'bo5']);
export const DraftModeSchema = z.enum(['standard', 'fearless']);
export const TiebreakCriterionSchema = z.enum([
  'head_to_head',
  'head_to_head_game_diff',
  'game_diff',
  'game_wins',
  'wins',
  'buchholz',
  'tiebreaker_match',
]);
export const SeedingMethodSchema = z.enum(['manual', 'random', 'rank']);
export const PrizeAwardTypeSchema = z.enum(['placement', 'mvp', 'special']);
export const PrizeTypeSchema = z.enum([
  'cash',
  'peripheral',
  'merch',
  'in_game',
  'voucher',
  'prestige',
  'custom',
]);
export const PrizeDistributionSchema = z.enum(['team', 'per_player', 'captain']);
export const NotificationChannelSchema = z.enum(['in_app', 'email', 'discord', 'push']);
export const NotificationTopicSchema = z.enum([
  'registration',
  'schedule',
  'reminders',
  'results',
  'announcements',
]);

const APEX = new Set(['master', 'grandmaster', 'challenger']);

/** A rank as packages/core reads it: apex tiers have no division. */
export const RankSchema = z
  .object({ tier: RankTierSchema, division: z.number().int().min(1).max(4).optional() })
  .refine((r) => APEX.has(r.tier) === (r.division === undefined), {
    message: 'division',
    path: ['division'],
  });

const IsoDateTime = z.iso.datetime({ offset: true });
const count = (max: number) => z.number().int().min(0).max(max);

/**
 * docs/13 §5. Exclusivity is not a rule here: it is the tournament scope
 * (`eligibility.exclusivityScope`) and the API adds it to the rules.
 */
export const EligibilityRuleSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('riot_account_verified') }),
  z.object({ type: z.literal('not_sanctioned') }),
  z.object({ type: z.literal('legal_name_required') }),
  z.object({
    type: z.literal('region'),
    params: z.object({ regions: z.array(GameRegionSchema).min(1) }),
  }),
  z.object({
    type: z.literal('country'),
    params: z.object({ countries: z.array(CountryCodeSchema).min(1).max(30) }),
  }),
  z.object({
    type: z.literal('rank_min'),
    params: z.object({ rank: RankSchema }),
    appliesTo: z.enum(['player', 'team_average']).optional(),
  }),
  z.object({
    type: z.literal('rank_max'),
    params: z.object({ rank: RankSchema }),
    appliesTo: z.enum(['player', 'team_average']).optional(),
  }),
  z.object({
    type: z.literal('peak_rank_max'),
    params: z.object({ rank: RankSchema, windowDays: z.number().int().min(1).max(365) }),
    appliesTo: z.enum(['player', 'team_average']).optional(),
  }),
  z.object({
    type: z.literal('account_level_min'),
    params: z.object({ level: count(2000) }),
  }),
  z.object({ type: z.literal('account_age_min'), params: z.object({ days: count(3650) }) }),
  z.object({ type: z.literal('ranked_games_min'), params: z.object({ games: count(2000) }) }),
  z.object({ type: z.literal('age_min'), params: z.object({ years: count(99) }) }),
  z.object({
    type: z.literal('gender'),
    params: z.object({
      allowed: z.array(GenderSchema).min(1).optional(),
      declaredBefore: IsoDateTime.optional(),
    }),
  }),
  z.object({
    type: z.literal('institution'),
    params: z
      .object({
        institutionId: z.string().trim().min(1).max(64).optional(),
        emailDomains: z
          .array(
            z
              .string()
              .trim()
              .toLowerCase()
              .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/),
          )
          .min(1)
          .max(10)
          .optional(),
      })
      .refine((p) => p.institutionId !== undefined || p.emailDomains !== undefined, {
        message: 'institution',
      }),
  }),
  z.object({ type: z.literal('max_tier_roster'), params: z.object({ tier: TierSchema }) }),
]);

export const ELIGIBILITY_RULE_TYPES = [
  'riot_account_verified',
  'not_sanctioned',
  'legal_name_required',
  'region',
  'country',
  'rank_min',
  'rank_max',
  'peak_rank_max',
  'account_level_min',
  'account_age_min',
  'ranked_games_min',
  'age_min',
  'gender',
  'institution',
  'max_tier_roster',
] as const satisfies readonly z.infer<typeof EligibilityRuleSchema>['type'][];

export const PointsConfigSchema = z.object({
  win: z.number().int().min(-10).max(10),
  loss: z.number().int().min(-10).max(10),
  draw: z.number().int().min(-10).max(10),
});

export const PhaseConfigSchema = z.object({
  name: z.string().trim().min(2).max(60),
  format: PhaseFormatSchema,
  seriesFormat: SeriesFormatSchema,
  /** Single and double elimination: series format of the final. */
  finalSeriesFormat: SeriesFormatSchema.nullable(),
  draftMode: DraftModeSchema,
  points: PointsConfigSchema,
  tiebreakers: z.array(TiebreakCriterionSchema).max(7),
  /** Entrants advancing to the next phase (per group in `groups`); `null` in the last phase. */
  advance: z.number().int().min(1).max(256).nullable(),
  groupCount: z.number().int().min(1).max(16).nullable(),
  /** Round robin and groups: 2 for home and away. */
  legs: z.union([z.literal(1), z.literal(2)]),
  thirdPlaceMatch: z.boolean(),
  grandFinalReset: z.boolean(),
  /** Swiss. */
  rounds: z.number().int().min(1).max(15).nullable(),
});

const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const ScheduleWindowSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startTime: Time,
    endTime: Time,
    slotMinutes: z.number().int().min(15).max(600),
    parallelMatches: z.number().int().min(1).max(64),
  })
  .refine((w) => w.endTime > w.startTime, { message: 'window_order', path: ['endTime'] });

export const ScheduleBlackoutSchema = z
  .object({ startsAt: IsoDateTime, endsAt: IsoDateTime, reason: optionalText(200) })
  .refine((b) => Date.parse(b.endsAt) > Date.parse(b.startsAt), {
    message: 'date_order',
    path: ['endsAt'],
  });

export const PrizeSchema = z.object({
  awardType: PrizeAwardTypeSchema,
  placementFrom: z.number().int().min(1).max(512).nullable(),
  placementTo: z.number().int().min(1).max(512).nullable(),
  label: optionalText(80),
  prizeType: PrizeTypeSchema,
  description: optionalText(500),
  /** Cents (docs/03 §0). */
  amount: z.number().int().min(0).max(100_000_000).nullable(),
  currency: z.literal('MXN').nullable(),
  quantity: z.number().int().min(1).max(100),
  distribution: PrizeDistributionSchema,
});

export const VenueSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: optionalText(200),
  city: z.string().trim().min(2).max(80),
  mapUrl: z.url().max(500).nullable(),
});

export const TournamentConfigSchema = z
  .object({
    basics: z.object({
      name: z.string().trim().min(3).max(80),
      type: TournamentTypeSchema,
      tier: TierSchema,
      visibility: TournamentVisibilitySchema,
      description: optionalText(2000),
      timezone: z
        .string()
        .regex(/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/)
        .max(64),
      seasonId: z.uuid().nullable(),
    }),
    capacity: z.object({
      capacity: z.number().int().min(2).max(512).nullable(),
      waitlistEnabled: z.boolean(),
    }),
    participants: z.object({
      entrantKind: EntrantKindSchema,
      teamSource: TeamSourceSchema,
      participantPolicy: ParticipantPolicySchema,
      maxRostersPerClub: z.number().int().min(1).max(10),
      modality: ModalitySchema,
      venue: VenueSchema.nullable(),
      /** Registration fee in cents; payments are not charged yet (phase 4). */
      fee: z
        .object({ amount: z.number().int().min(1).max(10_000_000), currency: z.literal('MXN') })
        .nullable(),
    }),
    game: z.object({
      teamSize: z.number().int().min(1).max(5),
      map: GameMapSchema,
      pickType: PickTypeSchema,
      spectatorType: SpectatorTypeSchema,
      customWinCondition: optionalText(200),
    }),
    eligibility: z.object({
      exclusivityScope: ExclusivityScopeSchema,
      circuitId: z.uuid().nullable(),
      rules: z.array(EligibilityRuleSchema).max(20),
    }),
    roster: z.object({
      starters: z.number().int().min(1).max(5),
      maxSubstitutes: z.number().int().min(0).max(5),
      coachAllowed: z.boolean(),
      maxRosterChanges: z.number().int().min(0).max(20).nullable(),
      minGamesForPlayoffs: z.number().int().min(0).max(50).nullable(),
      leaveCooldownDays: z.number().int().min(0).max(90),
    }),
    format: z.object({
      phases: z.array(PhaseConfigSchema).min(1).max(5),
      seedingMethod: SeedingMethodSchema,
    }),
    schedule: z.object({
      registrationOpensAt: IsoDateTime.nullable(),
      registrationClosesAt: IsoDateTime.nullable(),
      startsAt: IsoDateTime.nullable(),
      endsAt: IsoDateTime.nullable(),
      windows: z.array(ScheduleWindowSchema).max(21),
      blackouts: z.array(ScheduleBlackoutSchema).max(30),
      checkinOpensMinutes: z.number().int().min(5).max(240),
      checkinClosesMinutes: z.number().int().min(0).max(120),
      rescheduleWithinWindowsOnly: z.boolean(),
    }),
    broadcast: z.object({
      featuredMatches: z.boolean(),
      costreamPolicy: CostreamPolicySchema,
      costreamDelaySeconds: z.number().int().min(0).max(3600),
    }),
    supervision: z.object({ level: SupervisionLevelSchema }),
    /** Placeholder: the notifications module wires it (docs/15). */
    communication: z.object({
      channels: z.array(NotificationChannelSchema).max(4),
      topics: z.array(NotificationTopicSchema).max(5),
    }),
    prizes: z.object({
      hasPrizes: z.boolean(),
      poolSummary: optionalText(200),
      items: z.array(PrizeSchema).max(20),
    }),
  })
  .superRefine((config, ctx) => {
    const issue = (path: (string | number)[], message: string) => {
      ctx.addIssue({ code: 'custom', path, message });
    };
    if (config.roster.starters !== config.game.teamSize)
      issue(['roster', 'starters'], 'starters_team_size');
    if (config.participants.entrantKind === 'solo' && config.game.teamSize !== 1)
      issue(['game', 'teamSize'], 'solo_team_size');
    if (config.participants.modality !== 'online' && config.participants.venue === null)
      issue(['participants', 'venue'], 'venue_required');
    if (config.eligibility.exclusivityScope === 'season' && config.basics.seasonId === null)
      issue(['eligibility', 'exclusivityScope'], 'season_required');
    if (config.eligibility.exclusivityScope === 'circuit' && config.eligibility.circuitId === null)
      issue(['eligibility', 'exclusivityScope'], 'circuit_required');
    const {
      registrationOpensAt: opens,
      registrationClosesAt: closes,
      startsAt,
      endsAt,
    } = config.schedule;
    if (opens && closes && Date.parse(closes) <= Date.parse(opens))
      issue(['schedule', 'registrationClosesAt'], 'date_order');
    if (closes && startsAt && Date.parse(startsAt) < Date.parse(closes))
      issue(['schedule', 'startsAt'], 'date_order');
    if (startsAt && endsAt && Date.parse(endsAt) < Date.parse(startsAt))
      issue(['schedule', 'endsAt'], 'date_order');
    config.format.phases.forEach((phase, i) => {
      const last = i === config.format.phases.length - 1;
      if (last !== (phase.advance === null))
        issue(['format', 'phases', i, 'advance'], last ? 'last_phase_advance' : 'advance_required');
      if ((phase.format === 'groups') !== (phase.groupCount !== null))
        issue(['format', 'phases', i, 'groupCount'], 'group_count');
      if ((phase.format === 'swiss') !== (phase.rounds !== null))
        issue(['format', 'phases', i, 'rounds'], 'swiss_rounds');
    });
    config.prizes.items.forEach((prize, i) => {
      if (prize.awardType === 'placement' && prize.placementFrom === null)
        issue(['prizes', 'items', i, 'placementFrom'], 'placement_required');
      if (prize.amount !== null && prize.currency === null)
        issue(['prizes', 'items', i, 'currency'], 'currency_required');
    });
  });

export type TournamentType = z.infer<typeof TournamentTypeSchema>;
export type TournamentStatus = z.infer<typeof TournamentStatusSchema>;
export type TournamentVisibility = z.infer<typeof TournamentVisibilitySchema>;
export type PhaseFormat = z.infer<typeof PhaseFormatSchema>;
export type SeriesFormat = z.infer<typeof SeriesFormatSchema>;
export type EligibilityRuleConfig = z.infer<typeof EligibilityRuleSchema>;
export type EligibilityRuleType = EligibilityRuleConfig['type'];
export type RankConfig = z.infer<typeof RankSchema>;
export type PhaseConfig = z.infer<typeof PhaseConfigSchema>;
export type PrizeConfig = z.infer<typeof PrizeSchema>;
export type ScheduleWindow = z.infer<typeof ScheduleWindowSchema>;
export type TournamentConfig = z.infer<typeof TournamentConfigSchema>;
export type TournamentConfigInput = z.input<typeof TournamentConfigSchema>;
export type TournamentSectionKey = keyof TournamentConfig;

export const TOURNAMENT_TYPES = TournamentTypeSchema.options;
export const TOURNAMENT_STATUSES = TournamentStatusSchema.options;
export const PHASE_FORMATS = PhaseFormatSchema.options;
export const SERIES_FORMATS = SeriesFormatSchema.options;
export const TIEBREAK_CRITERIA_KEYS = TiebreakCriterionSchema.options;

/** Defaults of a new phase, by format (docs/02). */
export function defaultPhase(format: PhaseFormat, name: string): PhaseConfig {
  const elimination = format === 'single_elimination' || format === 'double_elimination';
  return {
    name,
    format,
    seriesFormat: elimination ? 'bo1' : 'bo3',
    finalSeriesFormat: elimination ? 'bo3' : null,
    draftMode: 'standard',
    points: { win: 3, loss: 0, draw: 1 },
    tiebreakers:
      format === 'swiss'
        ? ['buchholz', 'game_diff']
        : ['head_to_head', 'game_diff', 'tiebreaker_match'],
    advance: null,
    groupCount: format === 'groups' ? 2 : null,
    legs: 1,
    thirdPlaceMatch: false,
    grandFinalReset: false,
    rounds: format === 'swiss' ? 5 : null,
  };
}

/**
 * The pilot flash tournament (docs/02 §5 and §9): 5v5 single elimination,
 * Bo1 with a Bo3 final, 16 teams, verified Riot accounts. Every wizard starts here.
 */
export const DEFAULT_TOURNAMENT_CONFIG: TournamentConfig = {
  basics: {
    name: 'Nuevo torneo',
    type: 'flash',
    tier: 3,
    visibility: 'public',
    description: null,
    timezone: 'America/Mexico_City',
    seasonId: null,
  },
  capacity: { capacity: 16, waitlistEnabled: true },
  participants: {
    entrantKind: 'team',
    teamSource: 'permanent_only',
    participantPolicy: 'mixed',
    maxRostersPerClub: 1,
    modality: 'online',
    venue: null,
    fee: null,
  },
  game: {
    teamSize: 5,
    map: 'summoners_rift',
    pickType: 'tournament_draft',
    spectatorType: 'all',
    customWinCondition: null,
  },
  eligibility: {
    exclusivityScope: 'tournament',
    circuitId: null,
    rules: [{ type: 'riot_account_verified' }, { type: 'not_sanctioned' }],
  },
  roster: {
    starters: 5,
    maxSubstitutes: 2,
    coachAllowed: true,
    maxRosterChanges: null,
    minGamesForPlayoffs: null,
    leaveCooldownDays: 0,
  },
  format: {
    phases: [defaultPhase('single_elimination', 'Eliminación directa')],
    seedingMethod: 'random',
  },
  schedule: {
    registrationOpensAt: null,
    registrationClosesAt: null,
    startsAt: null,
    endsAt: null,
    windows: [],
    blackouts: [],
    checkinOpensMinutes: 30,
    checkinClosesMinutes: 10,
    rescheduleWithinWindowsOnly: true,
  },
  broadcast: { featuredMatches: false, costreamPolicy: 'disabled', costreamDelaySeconds: 0 },
  supervision: { level: 'dual_report' },
  communication: {
    channels: ['in_app', 'email'],
    topics: ['registration', 'schedule', 'reminders'],
  },
  prizes: { hasPrizes: false, poolSummary: null, items: [] },
};
