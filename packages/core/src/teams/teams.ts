// Team membership rules (docs/12-auth-roles-perfiles.md §4 and §6,
// docs/13-reglas-integridad.md §6). Pure: the caller loads the active roster.

import { TeamRuleError } from '../errors.js';

export type TeamRole = 'captain' | 'co_captain' | 'player' | 'substitute' | 'coach' | 'manager';

export type TeamPermission =
  | 'team:view_private'
  | 'team:edit'
  | 'team:invite'
  | 'team:manage_roster'
  | 'team:transfer_captaincy'
  | 'team:dissolve';

const MANAGER: readonly TeamPermission[] = [
  'team:view_private',
  'team:edit',
  'team:invite',
  'team:manage_roster',
];

const ROLE_PERMISSIONS: Readonly<Record<TeamRole, readonly TeamPermission[]>> = {
  captain: [...MANAGER, 'team:transfer_captaincy', 'team:dissolve'],
  // Same as the captain except dissolving the team or transferring the captaincy.
  co_captain: MANAGER,
  player: ['team:view_private'],
  substitute: ['team:view_private'],
  coach: ['team:view_private'],
  manager: ['team:view_private'],
};

const PLAYING_ROLES: ReadonlySet<TeamRole> = new Set([
  'captain',
  'co_captain',
  'player',
  'substitute',
]);

export interface ActiveMember {
  readonly userId: string;
  readonly role: TeamRole;
}

export interface TeamLimits {
  readonly maxTeamsCreated: number;
  readonly maxCaptaincies: number;
}

/** docs/13 §6: a user creates up to 2 permanent teams and captains 1 at a time. */
export const DEFAULT_TEAM_LIMITS: TeamLimits = { maxTeamsCreated: 2, maxCaptaincies: 1 };

export function teamCan(role: TeamRole, permission: TeamPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function isPlayingRole(role: TeamRole): boolean {
  return PLAYING_ROLES.has(role);
}

function fail(reason: string, details: Record<string, unknown> = {}): never {
  throw new TeamRuleError(`Team rule violated: ${reason}`, { reason, ...details });
}

const find = (members: readonly ActiveMember[], userId: string) =>
  members.find((m) => m.userId === userId);

function actorWith(
  members: readonly ActiveMember[],
  actorId: string,
  permission: TeamPermission,
): ActiveMember {
  const actor = find(members, actorId);
  if (!actor) fail('not_a_member');
  if (!teamCan(actor.role, permission)) fail('forbidden', { permission });
  return actor;
}

function target(members: readonly ActiveMember[], userId: string): ActiveMember {
  const member = find(members, userId);
  if (!member) fail('target_not_a_member');
  return member;
}

export interface CreateTeamState {
  readonly teamsCreated: number;
  readonly activeCaptaincies: number;
  readonly hasVerifiedRiotAccount: boolean;
}

/** The creator becomes captain, so the captaincy and Riot rules apply too. */
export function assertCanCreateTeam(
  state: CreateTeamState,
  limits: TeamLimits = DEFAULT_TEAM_LIMITS,
): void {
  if (!state.hasVerifiedRiotAccount) fail('riot_account_required');
  if (state.teamsCreated >= limits.maxTeamsCreated)
    fail('team_creation_limit', { max: limits.maxTeamsCreated });
  if (state.activeCaptaincies >= limits.maxCaptaincies)
    fail('captaincy_limit', { max: limits.maxCaptaincies });
}

export interface JoinCandidate {
  readonly userId: string;
  readonly role: TeamRole;
  readonly hasVerifiedRiotAccount: boolean;
}

/** Invitation accepted or join request approved. */
export function assertCanJoin(members: readonly ActiveMember[], candidate: JoinCandidate): void {
  if (find(members, candidate.userId)) fail('already_member');
  if (candidate.role === 'captain') fail('captain_not_assignable');
  if (isPlayingRole(candidate.role) && !candidate.hasVerifiedRiotAccount)
    fail('riot_account_required');
}

export function assertCanRemove(
  members: readonly ActiveMember[],
  actorId: string,
  targetId: string,
): void {
  actorWith(members, actorId, 'team:manage_roster');
  if (actorId === targetId) fail('use_leave');
  if (target(members, targetId).role === 'captain') fail('captain_protected');
}

export function assertCanLeave(members: readonly ActiveMember[], userId: string): void {
  const member = find(members, userId);
  if (!member) fail('not_a_member');
  if (member.role !== 'captain') return;
  fail(members.length === 1 ? 'captain_must_dissolve' : 'captain_must_transfer');
}

export function assertCanChangeRole(
  members: readonly ActiveMember[],
  actorId: string,
  targetId: string,
  role: TeamRole,
  { targetHasVerifiedRiotAccount = true }: { targetHasVerifiedRiotAccount?: boolean } = {},
): void {
  actorWith(members, actorId, 'team:manage_roster');
  const member = target(members, targetId);
  if (role === 'captain') fail('captain_not_assignable');
  if (member.role === 'captain') fail('captain_protected');
  if (isPlayingRole(role) && !targetHasVerifiedRiotAccount) fail('riot_account_required');
}

export function assertCanTransferCaptaincy(
  members: readonly ActiveMember[],
  actorId: string,
  targetId: string,
  {
    targetActiveCaptaincies = 0,
    limits = DEFAULT_TEAM_LIMITS,
  }: { targetActiveCaptaincies?: number; limits?: TeamLimits } = {},
): void {
  actorWith(members, actorId, 'team:transfer_captaincy');
  if (actorId === targetId) fail('already_captain');
  target(members, targetId);
  if (targetActiveCaptaincies >= limits.maxCaptaincies)
    fail('captaincy_limit', { max: limits.maxCaptaincies });
}
