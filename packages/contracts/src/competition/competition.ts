// Matches, results, disputes, rescheduling and standings (docs/03 §6.3–6.4,
// docs/13 §8–9, docs/14 §3.3).

import { z } from 'zod';

import { optionalText } from '../common/fields.js';
import { ReasonSchema } from '../riot/riot.js';
import {
  DraftModeSchema,
  PhaseFormatSchema,
  SeriesFormatSchema,
  TiebreakCriterionSchema,
  TournamentStatusSchema,
} from '../tournaments/config.js';

const IsoDateTime = z.iso.datetime({ offset: true });

export const MatchStatusSchema = z.enum([
  'pending',
  'scheduled',
  'checkin',
  'ready',
  'live',
  'awaiting_result',
  'disputed',
  'completed',
  'forfeit',
  'canceled',
]);
export const BracketSideSchema = z.enum(['upper', 'lower', 'final']);
export const ResultSourceSchema = z.enum([
  'riot_callback',
  'dual_report',
  'referee',
  'admin_override',
  'checkin_forfeit',
  'bye',
]);
export const DisputeCategorySchema = z.enum([
  'result',
  'conduct',
  'technical',
  'eligibility',
  'other',
]);
export const DisputeStatusSchema = z.enum(['open', 'under_review', 'resolved', 'rejected']);
export const RescheduleStatusSchema = z.enum([
  'pending',
  'accepted',
  'rejected',
  'approved_by_admin',
  'expired',
  'canceled',
]);
export const StandingStatusSchema = z.enum(['qualified', 'eliminated', 'in_contention']);
export const PhaseStatusSchema = z.enum(['pending', 'in_progress', 'completed']);
export const SlotSchema = z.enum(['a', 'b']);

export const ReportedGameSchema = z.object({
  number: z.number().int().min(1).max(9),
  winner: SlotSchema,
});

/** A list of game winners in order (Bo1/Bo3/Bo5): packages/core scores it. */
export const ReportedGamesSchema = z
  .array(ReportedGameSchema)
  .min(1)
  .max(9)
  .refine((games) => games.every((g, i) => g.number === i + 1), { message: 'game_numbers' });

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export const MatchEntrantSchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
  displayTag: z.string().nullable(),
  logoUrl: z.url().nullable(),
  teamSlug: z.string().nullable(),
  seed: z.number().int().nullable(),
});

/** Where an empty slot gets its entrant from (`winner` of match `r1-m2`…). */
export const SlotSourceSchema = z
  .object({ bracketKey: z.string(), outcome: z.enum(['winner', 'loser']) })
  .nullable();

export const MatchSummarySchema = z.object({
  id: z.uuid(),
  tournamentId: z.uuid(),
  phaseId: z.uuid(),
  phaseName: z.string(),
  groupName: z.string().nullable(),
  bracketKey: z.string(),
  round: z.number().int(),
  position: z.number().int(),
  bracketSide: BracketSideSchema.nullable(),
  seriesFormat: SeriesFormatSchema,
  draftMode: DraftModeSchema,
  status: MatchStatusSchema,
  scheduledAt: IsoDateTime.nullable(),
  checkinOpensAt: IsoDateTime.nullable(),
  checkinClosesAt: IsoDateTime.nullable(),
  entrantA: MatchEntrantSchema.nullable(),
  entrantB: MatchEntrantSchema.nullable(),
  sourceA: SlotSourceSchema,
  sourceB: SlotSourceSchema,
  scoreA: z.number().int(),
  scoreB: z.number().int(),
  winnerId: z.uuid().nullable(),
  resultSource: ResultSourceSchema.nullable(),
  finalizedAt: IsoDateTime.nullable(),
  version: z.number().int(),
});

export const ResultReportViewSchema = z.object({
  entrantId: z.uuid(),
  winnerId: z.uuid(),
  scoreA: z.number().int(),
  scoreB: z.number().int(),
  games: z.array(ReportedGameSchema),
  evidenceUrls: z.array(z.url()),
  submittedAt: IsoDateTime,
});

export const DisputeViewSchema = z.object({
  id: z.uuid(),
  category: DisputeCategorySchema,
  description: z.string(),
  status: DisputeStatusSchema,
  openedByEntrantId: z.uuid().nullable(),
  resolution: z.string().nullable(),
  resolvedAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
  evidence: z.array(
    z.object({
      id: z.uuid(),
      url: z.url().nullable(),
      note: z.string().nullable(),
      createdAt: IsoDateTime,
    }),
  ),
});

export const RescheduleViewSchema = z.object({
  id: z.uuid(),
  requestedByEntrantId: z.uuid(),
  proposedAt: z.array(IsoDateTime),
  chosenAt: IsoDateTime.nullable(),
  reason: z.string().nullable(),
  status: RescheduleStatusSchema,
  createdAt: IsoDateTime,
});

/** What the viewer may do on the match (portal); `null` for anyone else. */
export const MatchPermissionsSchema = z.object({
  entrantId: z.uuid().nullable(),
  canCheckIn: z.boolean(),
  canReport: z.boolean(),
  canDispute: z.boolean(),
  canRequestReschedule: z.boolean(),
  canRespondReschedule: z.boolean(),
  isStaff: z.boolean(),
});

export const MatchDetailSchema = MatchSummarySchema.extend({
  tournament: z.object({
    id: z.uuid(),
    slug: z.string(),
    name: z.string(),
    timezone: z.string(),
    status: TournamentStatusSchema,
  }),
  games: z.array(z.object({ number: z.number().int(), winnerId: z.uuid().nullable() })),
  checkedIn: z.array(z.uuid()),
  disputeDeadline: IsoDateTime.nullable(),
  /** Only for the two registrations and staff. */
  reports: z.array(ResultReportViewSchema),
  disputes: z.array(DisputeViewSchema),
  reschedules: z.array(RescheduleViewSchema),
  permissions: MatchPermissionsSchema.nullable(),
});

export const TiebreakStepSchema = z.object({
  criterion: TiebreakCriterionSchema,
  value: z.number(),
  among: z.array(z.uuid()),
});

export const StandingRowSchema = z.object({
  entrant: MatchEntrantSchema,
  rank: z.number().int(),
  points: z.number().int(),
  played: z.number().int(),
  wins: z.number().int(),
  losses: z.number().int(),
  draws: z.number().int(),
  gameWins: z.number().int(),
  gameLosses: z.number().int(),
  gameDiff: z.number().int(),
  status: StandingStatusSchema,
  /** How ties on points were broken, in order (packages/core). */
  tiebreaks: z.array(TiebreakStepSchema),
  tiedWith: z.array(z.uuid()),
});

export const PhaseBoardSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  position: z.number().int(),
  format: PhaseFormatSchema,
  seriesFormat: SeriesFormatSchema,
  status: PhaseStatusSchema,
  groups: z.array(
    z.object({
      id: z.uuid().nullable(),
      name: z.string().nullable(),
      standings: z.array(StandingRowSchema),
    }),
  ),
  matches: z.array(MatchSummarySchema),
  /** Entrants level at the cut line once the phase ended (needs a tiebreaker). */
  tiebreakRequired: z.boolean(),
});

export const TournamentBoardSchema = z.object({
  tournamentId: z.uuid(),
  status: TournamentStatusSchema,
  timezone: z.string(),
  phases: z.array(PhaseBoardSchema),
  champion: MatchEntrantSchema.nullable(),
  /** What staff can do next. */
  canGenerateFixtures: z.boolean(),
});

export const MyMatchSchema = MatchSummarySchema.extend({
  tournament: z.object({ id: z.uuid(), slug: z.string(), name: z.string(), timezone: z.string() }),
  myEntrantId: z.uuid(),
});

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export const ReportResultRequestSchema = z.object({
  games: ReportedGamesSchema,
  /** Paths returned by the evidence upload. */
  evidencePaths: z
    .array(z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/))
    .max(5)
    .default([]),
});

export const StaffResultRequestSchema = z.object({
  games: ReportedGamesSchema,
  reason: ReasonSchema,
});

export const StaffForfeitRequestSchema = z.object({
  loser: SlotSchema,
  reason: ReasonSchema,
});

export const OpenDisputeRequestSchema = z.object({
  category: DisputeCategorySchema.default('result'),
  description: z.string().trim().min(10).max(2000),
});

export const DisputeEvidenceRequestSchema = z
  .object({
    note: optionalText(1000).default(null),
    url: z.url().startsWith('https://').max(500).nullable().default(null),
    path: z
      .string()
      .regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/)
      .nullable()
      .default(null),
  })
  .refine((e) => e.note !== null || e.url !== null || e.path !== null, {
    message: 'evidence_empty',
  });

export const ResolveDisputeRequestSchema = z.object({
  resolution: z.string().trim().min(10).max(2000),
  /** `keep` confirms the current result; `override` sets `games`. `reject` dismisses the dispute. */
  outcome: z.enum(['keep', 'override', 'reject']),
  games: ReportedGamesSchema.nullable().default(null),
});

export const RescheduleRequestSchema = z.object({
  proposedAt: z.array(IsoDateTime).min(1).max(3),
  reason: optionalText(500).default(null),
});

export const RespondRescheduleRequestSchema = z.object({
  decision: z.enum(['accept', 'reject']),
  chosenAt: IsoDateTime.nullable().default(null),
});

export const DecideRescheduleRequestSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  reason: optionalText(500).default(null),
});

export const SetScheduleRequestSchema = z.object({
  scheduledAt: IsoDateTime,
  /** Required to move a match that already had a time. */
  reason: optionalText(500).default(null),
});

export const MatchActionSchema = z.enum(['open_checkin', 'close_checkin']);

export type MatchStatus = z.infer<typeof MatchStatusSchema>;
export type ResultSource = z.infer<typeof ResultSourceSchema>;
export type DisputeCategory = z.infer<typeof DisputeCategorySchema>;
export type DisputeStatus = z.infer<typeof DisputeStatusSchema>;
export type RescheduleStatus = z.infer<typeof RescheduleStatusSchema>;
export type StandingStatus = z.infer<typeof StandingStatusSchema>;
export type ReportedGameInput = z.infer<typeof ReportedGameSchema>;
export type MatchEntrant = z.infer<typeof MatchEntrantSchema>;
export type MatchSummary = z.infer<typeof MatchSummarySchema>;
export type ResultReportView = z.infer<typeof ResultReportViewSchema>;
export type DisputeView = z.infer<typeof DisputeViewSchema>;
export type RescheduleView = z.infer<typeof RescheduleViewSchema>;
export type MatchPermissions = z.infer<typeof MatchPermissionsSchema>;
export type MatchDetail = z.infer<typeof MatchDetailSchema>;
export type StandingRow = z.infer<typeof StandingRowSchema>;
export type PhaseBoard = z.infer<typeof PhaseBoardSchema>;
export type TournamentBoard = z.infer<typeof TournamentBoardSchema>;
export type MyMatch = z.infer<typeof MyMatchSchema>;
export type ReportResultRequest = z.infer<typeof ReportResultRequestSchema>;
export type StaffResultRequest = z.infer<typeof StaffResultRequestSchema>;
export type StaffForfeitRequest = z.infer<typeof StaffForfeitRequestSchema>;
export type OpenDisputeRequest = z.infer<typeof OpenDisputeRequestSchema>;
export type DisputeEvidenceRequest = z.infer<typeof DisputeEvidenceRequestSchema>;
export type ResolveDisputeRequest = z.infer<typeof ResolveDisputeRequestSchema>;
export type RescheduleRequest = z.infer<typeof RescheduleRequestSchema>;
export type RespondRescheduleRequest = z.infer<typeof RespondRescheduleRequestSchema>;
export type DecideRescheduleRequest = z.infer<typeof DecideRescheduleRequestSchema>;
export type SetScheduleRequest = z.infer<typeof SetScheduleRequestSchema>;
export type MatchAction = z.infer<typeof MatchActionSchema>;

export const MATCH_STATUSES = MatchStatusSchema.options;
