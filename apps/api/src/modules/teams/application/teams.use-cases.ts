// Team use cases: permission checks with packages/core, then the repository.

import {
  assertCanChangeRole,
  assertCanCreateTeam,
  assertCanJoin,
  assertCanLeave,
  assertCanRemove,
  assertCanTransferCaptaincy,
  DEFAULT_TEAM_LIMITS,
  teamCan,
  type TeamPermission,
} from '@league/core';
import type {
  ChangeMemberRoleRequest,
  CreateInvitationRequest,
  CreateJoinRequest,
  CreateTeamRequest,
  DecideJoinRequest,
  FreeAgentResponse,
  MyTeam,
  ReceivedInvitation,
  TeamDetail,
  TeamInvitation,
  TeamSummary,
  TransferCaptaincyRequest,
  UpdateFreeAgentRequest,
  UpdateTeamRequest,
} from '@league/contracts';

import { conflict, forbidden, notFound } from '../../../shared/application-error.js';
import { validateImage, type UploadedImage } from '../../../shared/storage/image.js';
import {
  FREE_AGENT_TTL_MS,
  INVITATION_TTL_MS,
  slugify,
  type InvitationRecord,
  type MemberRecord,
  type TeamRecord,
} from '../domain/team.js';
import type { TeamsDeps } from './deps.js';

const ALL_PERMISSIONS: readonly TeamPermission[] = [
  'team:view_private',
  'team:edit',
  'team:invite',
  'team:manage_roster',
  'team:transfer_captaincy',
  'team:dissolve',
];

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function loadTeam(deps: TeamsDeps, teamId: string): Promise<TeamRecord> {
  const team = await deps.teams.findById(teamId);
  if (!team) throw notFound('team_not_found');
  return team;
}

async function loadActiveTeam(deps: TeamsDeps, teamId: string): Promise<TeamRecord> {
  const team = await loadTeam(deps, teamId);
  if (team.status !== 'active') throw conflict('team_not_active');
  return team;
}

/** The actor's membership, requiring a permission. */
async function requireMember(
  deps: TeamsDeps,
  teamId: string,
  userId: string,
  permission: TeamPermission = 'team:view_private',
): Promise<{ members: MemberRecord[]; me: MemberRecord }> {
  const members = await deps.teams.activeMembers(teamId);
  const me = members.find((m) => m.userId === userId);
  if (!me) throw forbidden('not_a_member');
  if (!teamCan(me.teamRole, permission)) throw forbidden('forbidden');
  return { members, me };
}

const asRuleMembers = (members: readonly MemberRecord[]) =>
  members.map((m) => ({ userId: m.userId, role: m.teamRole }));

function toSummary(deps: TeamsDeps, team: TeamRecord): TeamSummary {
  return {
    id: team.id,
    slug: team.slug,
    name: team.name,
    tag: team.tag,
    region: team.region,
    logoUrl: deps.storage.publicUrl('team-logos', team.logoPath),
    status: team.status,
  };
}

function toInvitation(
  invitation: InvitationRecord,
  invited: { username: string | null; displayName: string | null } | undefined,
): TeamInvitation {
  return {
    id: invitation.id,
    teamRole: invitation.teamRole,
    status: invitation.status,
    expiresAt: invitation.expiresAt.toISOString(),
    invitedUser: invitation.invitedUserId
      ? {
          id: invitation.invitedUserId,
          username: invited?.username ?? null,
          displayName: invited?.displayName ?? null,
        }
      : null,
    inviteCode: invitation.inviteCode,
  };
}

/** The member view of a team. Invitations and requests only for those who manage them. */
async function buildDetail(
  deps: TeamsDeps,
  team: TeamRecord,
  viewerId: string,
): Promise<TeamDetail> {
  const members = await deps.teams.activeMembers(team.id);
  const me = members.find((m) => m.userId === viewerId) ?? null;
  const can = (permission: TeamPermission) => me !== null && teamCan(me.teamRole, permission);

  const [invitations, joinRequests, pendingTransfer, history] = await Promise.all([
    can('team:invite') ? deps.teams.pendingInvitationsOfTeam(team.id) : Promise.resolve([]),
    can('team:manage_roster') ? deps.teams.pendingJoinRequests(team.id) : Promise.resolve([]),
    me ? deps.teams.pendingTransfer(team.id) : Promise.resolve(null),
    deps.teams.nameHistory(team.id),
  ]);

  const userIds = [
    ...new Set([
      ...members.map((m) => m.userId),
      ...invitations.flatMap((i) => (i.invitedUserId ? [i.invitedUserId] : [])),
      ...joinRequests.map((r) => r.userId),
    ]),
  ];
  const [summaries, riotIds] = await Promise.all([
    deps.users.summaries(userIds),
    deps.riot.riotIdsOf(members.map((m) => m.userId)),
  ]);

  return {
    ...toSummary(deps, team),
    description: team.description,
    myRole: me?.teamRole ?? null,
    permissions: me ? ALL_PERMISSIONS.filter((p) => teamCan(me.teamRole, p)) : [],
    members: members.map((m) => ({
      userId: m.userId,
      username: summaries.get(m.userId)?.username ?? null,
      displayName: summaries.get(m.userId)?.displayName ?? null,
      avatarUrl: summaries.get(m.userId)?.avatarUrl ?? null,
      teamRole: m.teamRole,
      gameRole: m.gameRole,
      riotId: riotIds.get(m.userId) ?? null,
      joinedAt: m.joinedAt.toISOString(),
    })),
    invitations: invitations.map((i) =>
      toInvitation(i, i.invitedUserId ? summaries.get(i.invitedUserId) : undefined),
    ),
    joinRequests: joinRequests.map((r) => ({
      id: r.id,
      user: {
        id: r.userId,
        username: summaries.get(r.userId)?.username ?? null,
        displayName: summaries.get(r.userId)?.displayName ?? null,
      },
      message: r.message,
      createdAt: r.createdAt.toISOString(),
    })),
    pendingTransfer: pendingTransfer
      ? {
          id: pendingTransfer.id,
          fromUserId: pendingTransfer.fromUserId,
          toUserId: pendingTransfer.toUserId,
          createdAt: pendingTransfer.createdAt.toISOString(),
        }
      : null,
    nameHistory: history.map((h) => ({
      name: h.name,
      tag: h.tag,
      changedAt: h.changedAt.toISOString(),
    })),
    createdAt: team.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export class CreateTeamUseCase {
  constructor(private readonly deps: TeamsDeps) {}

  async execute(userId: string, input: CreateTeamRequest): Promise<TeamDetail> {
    const organizationId = await this.deps.organization.id();
    const [teamsCreated, activeCaptaincies, hasVerifiedRiotAccount] = await Promise.all([
      this.deps.teams.countTeamsCreatedBy(userId, organizationId),
      this.deps.teams.countActiveCaptaincies(userId),
      this.deps.riot.hasVerifiedAccount(userId),
    ]);
    assertCanCreateTeam(
      { teamsCreated, activeCaptaincies, hasVerifiedRiotAccount },
      DEFAULT_TEAM_LIMITS,
    );

    const base = slugify(input.name);
    let slug = base;
    for (let n = 2; await this.deps.teams.slugExists(organizationId, slug); n += 1)
      slug = `${base}-${String(n)}`;

    const teamId = await this.deps.teams.create({
      organizationId,
      ownerUserId: userId,
      slug,
      ...input,
    });
    return buildDetail(this.deps, await loadTeam(this.deps, teamId), userId);
  }
}

export class UpdateTeamUseCase {
  constructor(private readonly deps: TeamsDeps) {}

  /** The slug stays: links to the team keep working after a rename. */
  async execute(userId: string, teamId: string, input: UpdateTeamRequest): Promise<TeamDetail> {
    await loadActiveTeam(this.deps, teamId);
    await requireMember(this.deps, teamId, userId, 'team:edit');
    await this.deps.teams.update(teamId, input, userId);
    return buildDetail(this.deps, await loadTeam(this.deps, teamId), userId);
  }
}

export class UploadTeamLogoUseCase {
  constructor(private readonly deps: TeamsDeps) {}

  async execute(
    userId: string,
    teamId: string,
    file: UploadedImage | undefined,
  ): Promise<TeamDetail> {
    const image = validateImage(file);
    await loadActiveTeam(this.deps, teamId);
    await requireMember(this.deps, teamId, userId, 'team:edit');
    const path = `${teamId}/${this.deps.newId()}.${image.extension}`;
    await this.deps.storage.upload('team-logos', path, image.bytes, image.type);
    const previous = await this.deps.teams.setLogoPath(teamId, path, userId);
    if (previous) await this.deps.storage.remove('team-logos', previous);
    return buildDetail(this.deps, await loadTeam(this.deps, teamId), userId);
  }
}

export class ListMyTeamsUseCase {
  constructor(private readonly deps: TeamsDeps) {}

  async execute(userId: string): Promise<MyTeam[]> {
    const teams = await this.deps.teams.activeTeamsOf(userId);
    return teams.map(({ team, role }) => ({ ...toSummary(this.deps, team), myRole: role }));
  }
}

export class GetTeamUseCase {
  constructor(private readonly deps: TeamsDeps) {}

  async execute(userId: string, slug: string): Promise<TeamDetail> {
    const team = await this.deps.teams.findBySlug(await this.deps.organization.id(), slug);
    if (!team) throw notFound('team_not_found');
    await requireMember(this.deps, team.id, userId);
    return buildDetail(this.deps, team, userId);
  }
}

export class DissolveTeamUseCase {
  constructor(private readonly deps: TeamsDeps) {}

  /** Only without active registrations; there are no tournaments yet, so always allowed. Audited. */
  async execute(userId: string, teamId: string, reason: string): Promise<void> {
    await loadActiveTeam(this.deps, teamId);
    await requireMember(this.deps, teamId, userId, 'team:dissolve');
    await this.deps.teams.dissolve(teamId, userId, reason);
  }
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export class InviteToTeamUseCase {
  constructor(private readonly deps: TeamsDeps) {}

  async execute(
    userId: string,
    teamId: string,
    input: CreateInvitationRequest,
  ): Promise<TeamInvitation> {
    await loadActiveTeam(this.deps, teamId);
    const { members } = await requireMember(this.deps, teamId, userId, 'team:invite');
    const expiresAt = new Date(this.deps.clock.now().getTime() + INVITATION_TTL_MS);

    if (input.kind === 'user') {
      if (!(await this.deps.users.findById(input.userId))) throw notFound('user_not_found');
      if (members.some((m) => m.userId === input.userId)) throw conflict('already_member');
      const invitation = await this.deps.teams.createInvitation({
        teamId,
        invitedUserId: input.userId,
        inviteCode: null,
        teamRole: input.teamRole,
        expiresAt,
        createdBy: userId,
      });
      const summaries = await this.deps.users.summaries([input.userId]);
      return toInvitation(invitation, summaries.get(input.userId));
    }

    const invitation = await this.deps.teams.createInvitation({
      teamId,
      invitedUserId: null,
      inviteCode: this.deps.newCode(),
      teamRole: input.teamRole,
      expiresAt,
      createdBy: userId,
    });
    return toInvitation(invitation, undefined);
  }
}

export class RevokeInvitationUseCase {
  constructor(private readonly deps: TeamsDeps) {}

  async execute(userId: string, teamId: string, invitationId: string): Promise<void> {
    await requireMember(this.deps, teamId, userId, 'team:invite');
    const invitation = await this.deps.teams.findInvitation(invitationId);
    if (invitation?.teamId !== teamId || invitation.status !== 'pending')
      throw notFound('invitation_not_found');
    await this.deps.teams.setInvitationStatus(invitationId, 'revoked');
  }
}

async function toReceived(
  deps: TeamsDeps,
  invitation: InvitationRecord,
): Promise<ReceivedInvitation> {
  return {
    id: invitation.id,
    team: toSummary(deps, await loadTeam(deps, invitation.teamId)),
    teamRole: invitation.teamRole,
    expiresAt: invitation.expiresAt.toISOString(),
  };
}

export class ListMyInvitationsUseCase {
  constructor(private readonly deps: TeamsDeps) {}

  async execute(userId: string): Promise<ReceivedInvitation[]> {
    const now = this.deps.clock.now();
    const pending = (await this.deps.teams.pendingInvitationsFor(userId)).filter(
      (i) => i.expiresAt > now,
    );
    return Promise.all(pending.map((i) => toReceived(this.deps, i)));
  }
}

export class GetInvitationByCodeUseCase {
  constructor(private readonly deps: TeamsDeps) {}

  async execute(code: string): Promise<ReceivedInvitation> {
    const invitation = await this.deps.teams.findInvitationByCode(code);
    if (!invitation) throw notFound('invitation_not_found');
    if (invitation.status !== 'pending') throw conflict('invitation_not_pending');
    if (invitation.expiresAt <= this.deps.clock.now()) throw conflict('invitation_expired');
    return toReceived(this.deps, invitation);
  }
}

/** A personal invitation is only visible to its user; a link one to whoever has the code. */
async function invitationFor(
  deps: TeamsDeps,
  userId: string,
  ref: { invitationId: string } | { code: string },
): Promise<InvitationRecord> {
  const invitation =
    'code' in ref
      ? await deps.teams.findInvitationByCode(ref.code)
      : await deps.teams.findInvitation(ref.invitationId);
  if (!invitation) throw notFound('invitation_not_found');
  if (invitation.invitedUserId !== null && invitation.invitedUserId !== userId)
    throw notFound('invitation_not_found');
  if (invitation.status !== 'pending') throw conflict('invitation_not_pending');
  if (invitation.expiresAt <= deps.clock.now()) {
    await deps.teams.setInvitationStatus(invitation.id, 'expired');
    throw conflict('invitation_expired');
  }
  return invitation;
}

export class AcceptInvitationUseCase {
  constructor(private readonly deps: TeamsDeps) {}

  /** Membership rules are checked at acceptance (docs/12 §6). */
  async execute(
    userId: string,
    ref: { invitationId: string } | { code: string },
  ): Promise<TeamSummary> {
    const invitation = await invitationFor(this.deps, userId, ref);
    const team = await loadActiveTeam(this.deps, invitation.teamId);
    const members = await this.deps.teams.activeMembers(team.id);
    assertCanJoin(asRuleMembers(members), {
      userId,
      role: invitation.teamRole,
      hasVerifiedRiotAccount: await this.deps.riot.hasVerifiedAccount(userId),
    });
    await this.deps.teams.addMember({
      teamId: team.id,
      userId,
      teamRole: invitation.teamRole,
      actorId: userId,
      invitationId: invitation.id,
    });
    return toSummary(this.deps, team);
  }
}

export class DeclineInvitationUseCase {
  constructor(private readonly deps: TeamsDeps) {}

  async execute(userId: string, invitationId: string): Promise<void> {
    const invitation = await invitationFor(this.deps, userId, { invitationId });
    await this.deps.teams.setInvitationStatus(invitation.id, 'declined');
  }
}

// ---------------------------------------------------------------------------
// Join requests
// ---------------------------------------------------------------------------

export class RequestToJoinUseCase {
  constructor(private readonly deps: TeamsDeps) {}

  async execute(userId: string, teamId: string, input: CreateJoinRequest): Promise<{ id: string }> {
    await loadActiveTeam(this.deps, teamId);
    const members = await this.deps.teams.activeMembers(teamId);
    assertCanJoin(asRuleMembers(members), {
      userId,
      role: 'player',
      hasVerifiedRiotAccount: await this.deps.riot.hasVerifiedAccount(userId),
    });
    const request = await this.deps.teams.createJoinRequest(teamId, userId, input.message);
    return { id: request.id };
  }
}

export class DecideJoinRequestUseCase {
  constructor(private readonly deps: TeamsDeps) {}

  async execute(
    userId: string,
    teamId: string,
    requestId: string,
    input: DecideJoinRequest,
  ): Promise<TeamDetail> {
    const team = await loadActiveTeam(this.deps, teamId);
    const { members } = await requireMember(this.deps, teamId, userId, 'team:manage_roster');
    const request = await this.deps.teams.findJoinRequest(requestId);
    if (request?.teamId !== teamId || request.status !== 'pending')
      throw notFound('join_request_not_found');

    if (input.decision === 'decline') {
      await this.deps.teams.declineJoinRequest(requestId, userId);
    } else {
      assertCanJoin(asRuleMembers(members), {
        userId: request.userId,
        role: input.teamRole,
        hasVerifiedRiotAccount: await this.deps.riot.hasVerifiedAccount(request.userId),
      });
      await this.deps.teams.addMember({
        teamId,
        userId: request.userId,
        teamRole: input.teamRole,
        actorId: userId,
        joinRequestId: requestId,
      });
    }
    return buildDetail(this.deps, team, userId);
  }
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

export class ChangeMemberUseCase {
  constructor(private readonly deps: TeamsDeps) {}

  async execute(
    userId: string,
    teamId: string,
    targetId: string,
    input: ChangeMemberRoleRequest,
  ): Promise<TeamDetail> {
    const team = await loadActiveTeam(this.deps, teamId);
    const { members, me } = await requireMember(this.deps, teamId, userId);
    const target = members.find((m) => m.userId === targetId);
    if (!target) throw notFound('target_not_a_member');

    if (input.teamRole !== undefined && input.teamRole !== target.teamRole) {
      assertCanChangeRole(asRuleMembers(members), userId, targetId, input.teamRole, {
        targetHasVerifiedRiotAccount: await this.deps.riot.hasVerifiedAccount(targetId),
      });
    } else if (targetId !== userId && !teamCan(me.teamRole, 'team:manage_roster')) {
      // Anyone sets their own game role; managers set everyone's.
      throw forbidden('forbidden');
    }

    const changes = {
      ...(input.teamRole === undefined ? {} : { teamRole: input.teamRole }),
      ...(input.gameRole === undefined ? {} : { gameRole: input.gameRole }),
    };
    await this.deps.teams.updateMember(teamId, targetId, changes, userId);
    return buildDetail(this.deps, team, userId);
  }
}

export class RemoveMemberUseCase {
  constructor(private readonly deps: TeamsDeps) {}

  async execute(userId: string, teamId: string, targetId: string): Promise<void> {
    await loadActiveTeam(this.deps, teamId);
    assertCanRemove(asRuleMembers(await this.deps.teams.activeMembers(teamId)), userId, targetId);
    await this.deps.teams.removeMember(teamId, targetId, 'removed', userId);
  }
}

export class LeaveTeamUseCase {
  constructor(private readonly deps: TeamsDeps) {}

  async execute(userId: string, teamId: string): Promise<void> {
    await loadActiveTeam(this.deps, teamId);
    assertCanLeave(asRuleMembers(await this.deps.teams.activeMembers(teamId)), userId);
    await this.deps.teams.removeMember(teamId, userId, 'left', userId);
  }
}

// ---------------------------------------------------------------------------
// Captaincy transfer (the new captain accepts, docs/12 §6)
// ---------------------------------------------------------------------------

export class RequestCaptaincyTransferUseCase {
  constructor(private readonly deps: TeamsDeps) {}

  async execute(userId: string, teamId: string, input: TransferCaptaincyRequest): Promise<void> {
    await loadActiveTeam(this.deps, teamId);
    const members = await this.deps.teams.activeMembers(teamId);
    assertCanTransferCaptaincy(asRuleMembers(members), userId, input.toUserId, {
      targetActiveCaptaincies: await this.deps.teams.countActiveCaptaincies(input.toUserId),
    });
    await this.deps.teams.createTransfer(teamId, userId, input.toUserId);
  }
}

export class RespondCaptaincyTransferUseCase {
  constructor(private readonly deps: TeamsDeps) {}

  async execute(userId: string, teamId: string, decision: 'accept' | 'decline'): Promise<void> {
    await loadActiveTeam(this.deps, teamId);
    const transfer = await this.deps.teams.pendingTransfer(teamId);
    if (transfer?.toUserId !== userId) throw notFound('transfer_not_found');
    if (decision === 'decline') {
      await this.deps.teams.closeTransfer(transfer.id, 'declined');
      return;
    }
    // The rules may have changed since it was requested.
    assertCanTransferCaptaincy(
      asRuleMembers(await this.deps.teams.activeMembers(teamId)),
      transfer.fromUserId,
      userId,
      {
        targetActiveCaptaincies: await this.deps.teams.countActiveCaptaincies(userId),
      },
    );
    await this.deps.teams.acceptTransfer(transfer.id, 'Capitanía aceptada por el nuevo capitán');
  }
}

export class CancelCaptaincyTransferUseCase {
  constructor(private readonly deps: TeamsDeps) {}

  async execute(userId: string, teamId: string): Promise<void> {
    const transfer = await this.deps.teams.pendingTransfer(teamId);
    if (transfer?.fromUserId !== userId) throw notFound('transfer_not_found');
    await this.deps.teams.closeTransfer(transfer.id, 'canceled');
  }
}

// ---------------------------------------------------------------------------
// Free agents
// ---------------------------------------------------------------------------

const EMPTY_AVAILABILITY = { version: 1 as const, days: [], from: null, to: null };

export class GetFreeAgentUseCase {
  constructor(private readonly deps: TeamsDeps) {}

  async execute(userId: string): Promise<FreeAgentResponse> {
    const listing = await this.deps.freeAgents.find(userId, await this.deps.organization.id());
    if (!listing)
      return {
        active: false,
        roles: [],
        message: null,
        availability: EMPTY_AVAILABILITY,
        activeUntil: null,
      };
    return {
      active: listing.activeUntil > this.deps.clock.now(),
      roles: [...listing.roles],
      message: listing.message,
      availability: listing.availability,
      activeUntil: listing.activeUntil.toISOString(),
    };
  }
}

export class UpdateFreeAgentUseCase {
  constructor(private readonly deps: TeamsDeps) {}

  async execute(userId: string, input: UpdateFreeAgentRequest): Promise<FreeAgentResponse> {
    const now = this.deps.clock.now();
    const activeUntil = input.active ? new Date(now.getTime() + FREE_AGENT_TTL_MS) : now;
    const organizationId = await this.deps.organization.id();
    await this.deps.freeAgents.save(
      userId,
      organizationId,
      { roles: input.roles, message: input.message, availability: input.availability, activeUntil },
      input.active,
    );
    return new GetFreeAgentUseCase(this.deps).execute(userId);
  }
}

/** Read API for other modules (public pages). */
export class TeamQueries {
  constructor(private readonly deps: TeamsDeps) {}

  async findBySlug(slug: string): Promise<TeamRecord | null> {
    return this.deps.teams.findBySlug(await this.deps.organization.id(), slug);
  }

  activeMembers(teamId: string): Promise<MemberRecord[]> {
    return this.deps.teams.activeMembers(teamId);
  }

  activeTeamsOf(userId: string) {
    return this.deps.teams.activeTeamsOf(userId);
  }

  logoUrl(path: string | null): string | null {
    return this.deps.storage.publicUrl('team-logos', path);
  }
}
