// Registrations (entrants) and their rosters (docs/03 §6.2, docs/14 §3.3 and §4).

import { z } from 'zod';

import { optionalText, PlayerRoleSchema } from '../common/fields.js';
import { SeedingMethodSchema } from './config.js';
import { PublicTournamentDetailSchema, PublicTournamentListItemSchema } from './tournaments.js';

const IsoDateTime = z.iso.datetime({ offset: true });

export const EntrantStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'waitlisted',
  'withdrawn',
  'disqualified',
]);
export const RosterRoleSchema = z.enum(['starter', 'substitute', 'coach']);
export const PaymentStatusSchema = z.enum(['not_required', 'pending']);

export const RosterEntryRequestSchema = z.object({
  userId: z.uuid(),
  role: RosterRoleSchema,
  gameRole: PlayerRoleSchema.nullable().default(null),
});

export const RegistrationCheckRequestSchema = z.object({
  /** `null` for solo tournaments. */
  teamId: z.uuid().nullable(),
  roster: z.array(RosterEntryRequestSchema).min(1).max(11),
});

export const RegisterRequestSchema = RegistrationCheckRequestSchema.extend({
  /** The version shown to the captain; must still be the current one. */
  rulebookVersionId: z.uuid().nullable(),
  acceptRules: z.literal(true),
});

export const EligibilityFailureSchema = z.object({
  rule: z.string(),
  /** `null` when the rule failed for the whole entrant (team average). */
  userId: z.uuid().nullable(),
  reason: z.string(),
  details: z.record(z.string(), z.unknown()),
});

export const RosterViolationSchema = z.object({
  reason: z.string(),
  details: z.record(z.string(), z.unknown()),
});

/** Live validation of a registration: `ok` only when nothing blocks it. */
export const RegistrationCheckSchema = z.object({
  ok: z.boolean(),
  /** Codes that block before eligibility (registration closed, already registered…). */
  blockers: z.array(z.string()),
  rosterViolations: z.array(RosterViolationSchema),
  failures: z.array(EligibilityFailureSchema),
});

export const RosterMemberSchema = z.object({
  userId: z.uuid(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.url().nullable(),
  role: RosterRoleSchema,
  gameRole: PlayerRoleSchema.nullable(),
  riotId: z.string().nullable(),
});

/** Staff view of a registration, with its eligibility evaluated now. */
export const RegistrationSchema = z.object({
  id: z.uuid(),
  tournamentId: z.uuid(),
  status: EntrantStatusSchema,
  displayName: z.string(),
  displayTag: z.string().nullable(),
  logoUrl: z.url().nullable(),
  team: z.object({ id: z.uuid(), slug: z.string() }).nullable(),
  seed: z.number().int().nullable(),
  waitlistPosition: z.number().int().nullable(),
  rejectionReason: z.string().nullable(),
  paymentStatus: PaymentStatusSchema,
  rulebookVersion: z.number().int().nullable(),
  roster: z.array(RosterMemberSchema),
  eligibility: z.object({ eligible: z.boolean(), failures: z.array(EligibilityFailureSchema) }),
  registeredAt: IsoDateTime,
});

export const RegistrationDecisionSchema = z.enum(['approve', 'reject', 'promote', 'disqualify']);

export const DecideRegistrationRequestSchema = z.object({
  decision: RegistrationDecisionSchema,
  /** Required to reject, disqualify or approve an entrant that is not eligible. */
  reason: optionalText(500).default(null),
  /** Manual exception (docs/13 §4): approve despite failing rules, with a reason. */
  overrideEligibility: z.boolean().default(false),
});

export const SeedingRequestSchema = z.object({
  method: SeedingMethodSchema,
  /** Manual seeding only: every approved entrant once, seeds 1..n. */
  seeds: z
    .array(z.object({ entrantId: z.uuid(), seed: z.number().int().min(1).max(512) }))
    .max(512)
    .default([]),
});

export const RegistrationCountsSchema = z.record(
  z.uuid(),
  z.object({ pending: z.number().int(), approved: z.number().int(), waitlisted: z.number().int() }),
);

export const MyRegistrationSchema = z.object({
  id: z.uuid(),
  tournament: z.object({ id: z.uuid(), slug: z.string(), name: z.string() }),
  teamId: z.uuid().nullable(),
  status: EntrantStatusSchema,
  displayName: z.string(),
  waitlistPosition: z.number().int().nullable(),
  rejectionReason: z.string().nullable(),
  paymentStatus: PaymentStatusSchema,
  canWithdraw: z.boolean(),
  registeredAt: IsoDateTime,
});

/** One way the viewer could take part: a team they manage, or themselves. */
export const RegistrationOptionSchema = z.object({
  teamId: z.uuid().nullable(),
  label: z.string(),
  eligible: z.boolean(),
  failures: z.array(EligibilityFailureSchema),
  blockers: z.array(z.string()),
  registration: z.object({ id: z.uuid(), status: EntrantStatusSchema }).nullable(),
});

export const ExploreTournamentSchema = PublicTournamentListItemSchema.extend({
  options: z.array(RegistrationOptionSchema),
});

export const RegistrationContextSchema = z.object({
  tournament: PublicTournamentDetailSchema,
  teams: z.array(
    z.object({
      id: z.uuid(),
      slug: z.string(),
      name: z.string(),
      tag: z.string(),
      logoUrl: z.url().nullable(),
      members: z.array(
        z.object({
          userId: z.uuid(),
          username: z.string().nullable(),
          displayName: z.string().nullable(),
          teamRole: z.string(),
          gameRole: PlayerRoleSchema.nullable(),
        }),
      ),
    }),
  ),
  me: z.object({
    userId: z.uuid(),
    username: z.string().nullable(),
    displayName: z.string().nullable(),
  }),
  myRegistrations: z.array(MyRegistrationSchema),
});

export type EntrantStatus = z.infer<typeof EntrantStatusSchema>;
export type RosterRole = z.infer<typeof RosterRoleSchema>;
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;
export type RosterEntryRequest = z.infer<typeof RosterEntryRequestSchema>;
export type RegistrationCheckRequest = z.infer<typeof RegistrationCheckRequestSchema>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type EligibilityFailure = z.infer<typeof EligibilityFailureSchema>;
export type RosterViolation = z.infer<typeof RosterViolationSchema>;
export type RegistrationCheck = z.infer<typeof RegistrationCheckSchema>;
export type RosterMember = z.infer<typeof RosterMemberSchema>;
export type Registration = z.infer<typeof RegistrationSchema>;
export type RegistrationDecision = z.infer<typeof RegistrationDecisionSchema>;
export type DecideRegistrationRequest = z.infer<typeof DecideRegistrationRequestSchema>;
export type SeedingRequest = z.infer<typeof SeedingRequestSchema>;
export type RegistrationCounts = z.infer<typeof RegistrationCountsSchema>;
export type MyRegistration = z.infer<typeof MyRegistrationSchema>;
export type RegistrationOption = z.infer<typeof RegistrationOptionSchema>;
export type ExploreTournament = z.infer<typeof ExploreTournamentSchema>;
export type RegistrationContext = z.infer<typeof RegistrationContextSchema>;

export const ENTRANT_STATUSES = EntrantStatusSchema.options;
export const ROSTER_ROLES = RosterRoleSchema.options;
