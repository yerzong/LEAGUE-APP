import type { AssignableTeamRole, GameRegion, PlayerRole } from '@league/contracts';

import type {
  FreeAgentRecord,
  InvitationRecord,
  JoinRequestRecord,
  MemberRecord,
  TeamRecord,
  TransferRecord,
} from '../domain/team.js';

export interface NewTeam {
  readonly organizationId: string;
  readonly ownerUserId: string;
  readonly name: string;
  readonly tag: string;
  readonly slug: string;
  readonly region: GameRegion;
  readonly description: string | null;
}

export interface TeamRepository {
  /** Throws `team_name_taken`, `team_tag_taken` or `team_slug_taken`. */
  create(team: NewTeam): Promise<string>;
  findById(teamId: string): Promise<TeamRecord | null>;
  findBySlug(organizationId: string, slug: string): Promise<TeamRecord | null>;
  slugExists(organizationId: string, slug: string): Promise<boolean>;
  /** Throws `team_name_taken` or `team_tag_taken`. */
  update(
    teamId: string,
    changes: Pick<TeamRecord, 'name' | 'tag' | 'region' | 'description'>,
    actorId: string,
  ): Promise<void>;
  /** Returns the previous path. */
  setLogoPath(teamId: string, path: string, actorId: string): Promise<string | null>;
  nameHistory(teamId: string): Promise<{ name: string; tag: string; changedAt: Date }[]>;
  activeMembers(teamId: string): Promise<MemberRecord[]>;
  /** Active teams of the organization, newest first, filtered by name or tag. */
  listActive(
    organizationId: string,
    window: { query: string; limit: number; offset: number },
  ): Promise<{ teams: TeamRecord[]; total: number }>;
  activeMemberCounts(teamIds: readonly string[]): Promise<Map<string, number>>;
  activeTeamsOf(userId: string): Promise<{ team: TeamRecord; role: MemberRecord['teamRole'] }[]>;
  countTeamsCreatedBy(userId: string, organizationId: string): Promise<number>;
  countActiveCaptaincies(userId: string): Promise<number>;
  /** Adds a member (from an invitation or join request, settling them). Throws `already_member`. */
  addMember(input: {
    teamId: string;
    userId: string;
    teamRole: AssignableTeamRole;
    actorId: string;
    invitationId?: string;
    joinRequestId?: string;
  }): Promise<void>;
  updateMember(
    teamId: string,
    userId: string,
    changes: { teamRole?: AssignableTeamRole; gameRole?: PlayerRole | null },
    actorId: string,
  ): Promise<void>;
  removeMember(
    teamId: string,
    userId: string,
    reason: 'removed' | 'left',
    actorId: string,
  ): Promise<void>;
  /** Disbands the team, releases the roster and audits it. */
  dissolve(teamId: string, actorId: string, reason: string): Promise<void>;

  /** Throws `invitation_already_pending`. */
  createInvitation(input: Omit<InvitationRecord, 'id' | 'status'>): Promise<InvitationRecord>;
  findInvitation(invitationId: string): Promise<InvitationRecord | null>;
  findInvitationByCode(code: string): Promise<InvitationRecord | null>;
  pendingInvitationsOfTeam(teamId: string): Promise<InvitationRecord[]>;
  pendingInvitationsFor(userId: string): Promise<InvitationRecord[]>;
  setInvitationStatus(
    invitationId: string,
    status: 'declined' | 'expired' | 'revoked',
  ): Promise<void>;

  /** Throws `join_request_already_pending`. */
  createJoinRequest(
    teamId: string,
    userId: string,
    message: string | null,
  ): Promise<JoinRequestRecord>;
  findJoinRequest(requestId: string): Promise<JoinRequestRecord | null>;
  pendingJoinRequests(teamId: string): Promise<JoinRequestRecord[]>;
  declineJoinRequest(requestId: string, actorId: string): Promise<void>;

  /** Throws `transfer_already_pending`. */
  createTransfer(teamId: string, fromUserId: string, toUserId: string): Promise<TransferRecord>;
  pendingTransfer(teamId: string): Promise<TransferRecord | null>;
  findTransfer(transferId: string): Promise<TransferRecord | null>;
  /** Swaps the roles, updates the owner and audits it. */
  acceptTransfer(transferId: string, reason: string): Promise<void>;
  closeTransfer(transferId: string, status: 'declined' | 'canceled'): Promise<void>;
}

export interface FreeAgentRepository {
  find(userId: string, organizationId: string): Promise<FreeAgentRecord | null>;
  save(
    userId: string,
    organizationId: string,
    listing: FreeAgentRecord,
    active: boolean,
  ): Promise<void>;
}

/** From identity (ProfileQueries). */
export interface UserDirectory {
  summaries(
    userIds: readonly string[],
  ): Promise<
    Map<string, { username: string | null; displayName: string | null; avatarUrl: string | null }>
  >;
  findById(userId: string): Promise<{ id: string } | null>;
}

/** From riot-accounts (RiotAccountQueries). */
export interface RiotStatus {
  hasVerifiedAccount(userId: string): Promise<boolean>;
  riotIdsOf(userIds: readonly string[]): Promise<Map<string, string>>;
}

/** Unguessable invitation codes. */
export type CodeGenerator = () => string;

export const TEAM_REPOSITORY = Symbol('TeamRepository');
export const FREE_AGENT_REPOSITORY = Symbol('FreeAgentRepository');
export const USER_DIRECTORY = Symbol('UserDirectory');
export const RIOT_STATUS = Symbol('RiotStatus');
export const CODE_GENERATOR = Symbol('CodeGenerator');
