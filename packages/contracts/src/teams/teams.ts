import { z } from 'zod';

import { GameRegionSchema, optionalText, PlayerRoleSchema } from '../common/fields.js';
import { ReasonSchema } from '../riot/riot.js';

export const TeamRoleSchema = z.enum([
  'captain',
  'co_captain',
  'player',
  'substitute',
  'coach',
  'manager',
]);
/** Roles that can be given by invitation or role change (the captaincy is transferred). */
export const AssignableTeamRoleSchema = TeamRoleSchema.exclude(['captain']);
export const TeamStatusSchema = z.enum(['active', 'inactive', 'disbanded', 'banned']);

export const TeamNameSchema = z.string().trim().min(3).max(32);
export const TeamTagSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{2,5}$/);

export const CreateTeamRequestSchema = z.object({
  name: TeamNameSchema,
  tag: TeamTagSchema,
  region: GameRegionSchema,
  description: optionalText(500),
});

export const UpdateTeamRequestSchema = CreateTeamRequestSchema;

export const TeamPermissionSchema = z.enum([
  'team:view_private',
  'team:edit',
  'team:invite',
  'team:manage_roster',
  'team:transfer_captaincy',
  'team:dissolve',
]);

export const TeamSummarySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  tag: z.string(),
  region: GameRegionSchema,
  logoUrl: z.url().nullable(),
  status: TeamStatusSchema,
});

export const MyTeamSchema = TeamSummarySchema.extend({ myRole: TeamRoleSchema });

export const TeamMemberSchema = z.object({
  userId: z.uuid(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.url().nullable(),
  teamRole: TeamRoleSchema,
  gameRole: PlayerRoleSchema.nullable(),
  riotId: z.string().nullable(),
  joinedAt: z.iso.datetime({ offset: true }),
});

export const InvitationStatusSchema = z.enum([
  'pending',
  'accepted',
  'declined',
  'expired',
  'revoked',
]);

export const TeamInvitationSchema = z.object({
  id: z.uuid(),
  teamRole: AssignableTeamRoleSchema,
  status: InvitationStatusSchema,
  expiresAt: z.iso.datetime({ offset: true }),
  /** Set for invitations to a specific user. */
  invitedUser: z
    .object({ id: z.uuid(), username: z.string().nullable(), displayName: z.string().nullable() })
    .nullable(),
  /** Set for link invitations: the web builds the URL from it. */
  inviteCode: z.string().nullable(),
});

export const JoinRequestSchema = z.object({
  id: z.uuid(),
  user: z.object({
    id: z.uuid(),
    username: z.string().nullable(),
    displayName: z.string().nullable(),
  }),
  message: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});

export const CaptaincyTransferSchema = z.object({
  id: z.uuid(),
  fromUserId: z.uuid(),
  toUserId: z.uuid(),
  createdAt: z.iso.datetime({ offset: true }),
});

/** A team as seen by one of its members. Invitations and requests only for managers. */
export const TeamDetailSchema = TeamSummarySchema.extend({
  description: z.string().nullable(),
  myRole: TeamRoleSchema.nullable(),
  permissions: z.array(TeamPermissionSchema),
  members: z.array(TeamMemberSchema),
  invitations: z.array(TeamInvitationSchema),
  joinRequests: z.array(JoinRequestSchema),
  pendingTransfer: CaptaincyTransferSchema.nullable(),
  nameHistory: z.array(
    z.object({ name: z.string(), tag: z.string(), changedAt: z.iso.datetime({ offset: true }) }),
  ),
  createdAt: z.iso.datetime({ offset: true }),
});

export const CreateInvitationRequestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('user'), userId: z.uuid(), teamRole: AssignableTeamRoleSchema }),
  z.object({ kind: z.literal('link'), teamRole: AssignableTeamRoleSchema }),
]);

/** An invitation as seen by the invited user (or anyone with the link). */
export const ReceivedInvitationSchema = z.object({
  id: z.uuid(),
  team: TeamSummarySchema,
  teamRole: AssignableTeamRoleSchema,
  expiresAt: z.iso.datetime({ offset: true }),
});

/** `teamRole` changes the internal role; `gameRole` (top, jungle…) can be set for anyone, captain included. */
export const ChangeMemberRoleRequestSchema = z
  .object({
    teamRole: AssignableTeamRoleSchema.optional(),
    gameRole: PlayerRoleSchema.nullable().optional(),
  })
  .refine((v) => v.teamRole !== undefined || v.gameRole !== undefined, 'nothing_to_change');

export const DecideJoinRequestSchema = z.object({
  decision: z.enum(['approve', 'decline']),
  teamRole: AssignableTeamRoleSchema.default('player'),
});

export const CreateJoinRequestSchema = z.object({ message: optionalText(280) });

export const TransferCaptaincyRequestSchema = z.object({ toUserId: z.uuid() });

export const DissolveTeamRequestSchema = z.object({ reason: ReasonSchema });

export const UserSearchResultSchema = z.object({
  id: z.uuid(),
  username: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.url().nullable(),
});

export const UserSearchQuerySchema = z.object({ q: z.string().trim().min(2).max(20) });

const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** `free_agent_listings.availability`, versioned. Days: 0 = Sunday. */
export const FreeAgentAvailabilitySchema = z.object({
  version: z.literal(1),
  days: z.array(z.number().int().min(0).max(6)).max(7),
  from: TimeSchema.nullable(),
  to: TimeSchema.nullable(),
});

export const UpdateFreeAgentRequestSchema = z.object({
  active: z.boolean(),
  roles: z.array(PlayerRoleSchema).min(1).max(5),
  message: optionalText(280),
  availability: FreeAgentAvailabilitySchema,
});

export const FreeAgentResponseSchema = z.object({
  active: z.boolean(),
  roles: z.array(PlayerRoleSchema),
  message: z.string().nullable(),
  availability: FreeAgentAvailabilitySchema,
  activeUntil: z.iso.datetime({ offset: true }).nullable(),
});

export type TeamRole = z.infer<typeof TeamRoleSchema>;
export type AssignableTeamRole = z.infer<typeof AssignableTeamRoleSchema>;
export type TeamStatus = z.infer<typeof TeamStatusSchema>;
export type TeamPermission = z.infer<typeof TeamPermissionSchema>;
export type CreateTeamRequest = z.infer<typeof CreateTeamRequestSchema>;
export type CreateTeamInput = z.input<typeof CreateTeamRequestSchema>;
export type UpdateTeamRequest = z.infer<typeof UpdateTeamRequestSchema>;
export type TeamSummary = z.infer<typeof TeamSummarySchema>;
export type MyTeam = z.infer<typeof MyTeamSchema>;
export type TeamMember = z.infer<typeof TeamMemberSchema>;
export type TeamInvitation = z.infer<typeof TeamInvitationSchema>;
export type JoinRequest = z.infer<typeof JoinRequestSchema>;
export type CaptaincyTransfer = z.infer<typeof CaptaincyTransferSchema>;
export type TeamDetail = z.infer<typeof TeamDetailSchema>;
export type CreateInvitationRequest = z.infer<typeof CreateInvitationRequestSchema>;
export type ReceivedInvitation = z.infer<typeof ReceivedInvitationSchema>;
export type ChangeMemberRoleRequest = z.infer<typeof ChangeMemberRoleRequestSchema>;
export type DecideJoinRequest = z.infer<typeof DecideJoinRequestSchema>;
export type CreateJoinRequest = z.infer<typeof CreateJoinRequestSchema>;
export type TransferCaptaincyRequest = z.infer<typeof TransferCaptaincyRequestSchema>;
export type DissolveTeamRequest = z.infer<typeof DissolveTeamRequestSchema>;
export type UserSearchResult = z.infer<typeof UserSearchResultSchema>;
export type FreeAgentAvailability = z.infer<typeof FreeAgentAvailabilitySchema>;
export type UpdateFreeAgentRequest = z.infer<typeof UpdateFreeAgentRequestSchema>;
export type UpdateFreeAgentInput = z.input<typeof UpdateFreeAgentRequestSchema>;
export type FreeAgentResponse = z.infer<typeof FreeAgentResponseSchema>;

export const TEAM_ROLES = TeamRoleSchema.options;
export const ASSIGNABLE_TEAM_ROLES = AssignableTeamRoleSchema.options;
