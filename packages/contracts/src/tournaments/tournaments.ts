// Admin, portal and public views of tournaments (docs/14 §3).

import { z } from 'zod';

import { optionalText } from '../common/fields.js';
import {
  DraftModeSchema,
  EligibilityRuleSchema,
  EntrantKindSchema,
  ExclusivityScopeSchema,
  GameMapSchema,
  ModalitySchema,
  PhaseFormatSchema,
  PickTypeSchema,
  PrizeSchema,
  ScheduleWindowSchema,
  SeriesFormatSchema,
  SupervisionLevelSchema,
  TierSchema,
  TournamentConfigSchema,
  TournamentStatusSchema,
  TournamentTypeSchema,
  TournamentVisibilitySchema,
  VenueSchema,
} from './config.js';

const IsoDateTime = z.iso.datetime({ offset: true });

export const TournamentSectionSchema = z.enum([
  'basics',
  'capacity',
  'participants',
  'game',
  'eligibility',
  'roster',
  'format',
  'schedule',
  'broadcast',
  'supervision',
  'communication',
  'prizes',
]);
export const EditModeSchema = z.enum(['free', 'confirm', 'locked']);
export const EditPolicySchema = z.record(TournamentSectionSchema, EditModeSchema);

/** Lifecycle actions staff can take (packages/core tournamentLifecycle). */
export const TournamentActionSchema = z.enum([
  'publish',
  'open_registration',
  'close_registration',
  'reopen_registration',
  'cancel',
  'archive',
]);

export const CreateTournamentRequestSchema = z.object({
  config: TournamentConfigSchema,
  templateId: z.uuid().nullable().default(null),
});

export const UpdateTournamentRequestSchema = z.object({
  config: TournamentConfigSchema,
  /** Required when a changed section needs confirmation (docs/14 §3.2). */
  confirm: z.boolean().default(false),
  reason: optionalText(500).default(null),
});

export const TournamentActionRequestSchema = z.object({
  reason: optionalText(500).default(null),
});

export const RulebookDraftRequestSchema = z.object({
  title: z.string().trim().min(3).max(120),
  content: z.string().trim().min(1).max(50_000),
  changeSummary: optionalText(500),
});

export const PhaseShapeSchema = z.object({
  entrants: z.number().int(),
  rounds: z.number().int(),
  matches: z.number().int(),
  groups: z.array(z.number().int()),
});

export const TournamentPhaseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  position: z.number().int(),
  format: PhaseFormatSchema,
  seriesFormat: SeriesFormatSchema,
  groups: z.array(z.object({ id: z.uuid(), name: z.string() })),
});

export const RulebookVersionSchema = z.object({
  id: z.uuid(),
  version: z.number().int(),
  content: z.string(),
  changeSummary: z.string().nullable(),
  publishedAt: IsoDateTime.nullable(),
});

export const TournamentSummarySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  type: TournamentTypeSchema,
  tier: TierSchema,
  status: TournamentStatusSchema,
  visibility: TournamentVisibilitySchema,
  coverUrl: z.url().nullable(),
  entrantKind: EntrantKindSchema,
  teamSize: z.number().int(),
  capacity: z.number().int().nullable(),
  registrationOpensAt: IsoDateTime.nullable(),
  registrationClosesAt: IsoDateTime.nullable(),
  startsAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
});

export const TournamentDetailSchema = TournamentSummarySchema.extend({
  config: TournamentConfigSchema,
  templateId: z.uuid().nullable(),
  publishedAt: IsoDateTime.nullable(),
  phases: z.array(TournamentPhaseSchema),
  rulebook: z
    .object({
      title: z.string(),
      current: RulebookVersionSchema.nullable(),
      draft: RulebookVersionSchema.nullable(),
      versions: z.array(RulebookVersionSchema.omit({ content: true })),
    })
    .nullable(),
  editPolicy: EditPolicySchema,
  actions: z.array(TournamentActionSchema),
  /** Bracket/structure preview for the capacity; `error` is the format error code. */
  preview: z.object({ shapes: z.array(PhaseShapeSchema), error: z.string().nullable() }),
  /** What is still missing to publish (codes). */
  publishIssues: z.array(z.string()),
});

export const AuditEntrySchema = z.object({
  id: z.uuid(),
  action: z.string(),
  actor: z
    .object({ username: z.string().nullable(), displayName: z.string().nullable() })
    .nullable(),
  entityType: z.string(),
  entityId: z.uuid().nullable(),
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown()).nullable(),
  reason: z.string().nullable(),
  createdAt: IsoDateTime,
});

export const TournamentTemplateSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  config: TournamentConfigSchema,
  createdAt: IsoDateTime,
});

export const CreateTemplateRequestSchema = z.object({
  name: z.string().trim().min(3).max(80),
  config: TournamentConfigSchema,
});

// ---------------------------------------------------------------------------
// Public site and portal
// ---------------------------------------------------------------------------

/** Public filter: maps to tournament statuses in the API. */
export const PublicTournamentFilterSchema = z.enum(['all', 'open', 'upcoming', 'live', 'finished']);

export const PublicTournamentQuerySchema = z.object({
  status: PublicTournamentFilterSchema.default('all'),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

export const PublicTournamentListItemSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  type: TournamentTypeSchema,
  tier: TierSchema,
  status: TournamentStatusSchema,
  coverUrl: z.url().nullable(),
  entrantKind: EntrantKindSchema,
  teamSize: z.number().int(),
  map: GameMapSchema,
  modality: ModalitySchema,
  capacity: z.number().int().nullable(),
  approvedCount: z.number().int(),
  registrationOpensAt: IsoDateTime.nullable(),
  registrationClosesAt: IsoDateTime.nullable(),
  startsAt: IsoDateTime.nullable(),
  endsAt: IsoDateTime.nullable(),
  hasPrizes: z.boolean(),
  prizePoolSummary: z.string().nullable(),
});

export const PublicParticipantSchema = z.object({
  displayName: z.string(),
  displayTag: z.string().nullable(),
  logoUrl: z.url().nullable(),
  teamSlug: z.string().nullable(),
  seed: z.number().int().nullable(),
});

export const PublicTournamentDetailSchema = PublicTournamentListItemSchema.extend({
  description: z.string().nullable(),
  timezone: z.string(),
  venue: VenueSchema.nullable(),
  pickType: PickTypeSchema,
  customWinCondition: z.string().nullable(),
  fee: z.object({ amount: z.number().int(), currency: z.string() }).nullable(),
  supervisionLevel: SupervisionLevelSchema,
  phases: z.array(
    z.object({
      name: z.string(),
      position: z.number().int(),
      format: PhaseFormatSchema,
      seriesFormat: SeriesFormatSchema,
      finalSeriesFormat: SeriesFormatSchema.nullable(),
      draftMode: DraftModeSchema,
      advance: z.number().int().nullable(),
      groups: z.array(z.string()),
    }),
  ),
  eligibility: z.object({
    exclusivityScope: ExclusivityScopeSchema,
    rules: z.array(EligibilityRuleSchema),
  }),
  roster: z.object({
    starters: z.number().int(),
    maxSubstitutes: z.number().int(),
    coachAllowed: z.boolean(),
  }),
  windows: z.array(ScheduleWindowSchema),
  prizes: z.array(PrizeSchema),
  rulebook: z
    .object({
      id: z.uuid(),
      version: z.number().int(),
      content: z.string(),
      publishedAt: IsoDateTime,
    })
    .nullable(),
  participants: z.array(PublicParticipantSchema),
});

const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
  });

export const PublicTournamentListSchema = pageOf(PublicTournamentListItemSchema);

export type TournamentSection = z.infer<typeof TournamentSectionSchema>;
export type EditMode = z.infer<typeof EditModeSchema>;
export type TournamentAction = z.infer<typeof TournamentActionSchema>;
export type CreateTournamentRequest = z.infer<typeof CreateTournamentRequestSchema>;
export type UpdateTournamentRequest = z.infer<typeof UpdateTournamentRequestSchema>;
export type TournamentActionRequest = z.infer<typeof TournamentActionRequestSchema>;
export type RulebookDraftRequest = z.infer<typeof RulebookDraftRequestSchema>;
export type PhaseShape = z.infer<typeof PhaseShapeSchema>;
export type TournamentPhase = z.infer<typeof TournamentPhaseSchema>;
export type RulebookVersion = z.infer<typeof RulebookVersionSchema>;
export type TournamentSummary = z.infer<typeof TournamentSummarySchema>;
export type TournamentDetail = z.infer<typeof TournamentDetailSchema>;
export type AuditEntry = z.infer<typeof AuditEntrySchema>;
export type TournamentTemplate = z.infer<typeof TournamentTemplateSchema>;
export type CreateTemplateRequest = z.infer<typeof CreateTemplateRequestSchema>;
export type PublicTournamentFilter = z.infer<typeof PublicTournamentFilterSchema>;
export type PublicTournamentQuery = z.infer<typeof PublicTournamentQuerySchema>;
export type PublicTournamentListItem = z.infer<typeof PublicTournamentListItemSchema>;
export type PublicParticipant = z.infer<typeof PublicParticipantSchema>;
export type PublicTournamentDetail = z.infer<typeof PublicTournamentDetailSchema>;
export type PublicTournamentList = z.infer<typeof PublicTournamentListSchema>;

export const TOURNAMENT_SECTION_KEYS = TournamentSectionSchema.options;
export const TOURNAMENT_ACTIONS = TournamentActionSchema.options;
