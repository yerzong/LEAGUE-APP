// Test double for TeamRepository with the uniqueness rules of the database
// (name/tag per organization, one active membership, one pending item).
import type { AssignableTeamRole, PlayerRole } from '@league/contracts';

import { conflict } from '../../../shared/application-error.js';
import type { FreeAgentRepository, NewTeam, TeamRepository } from '../application/ports.js';
import type {
  FreeAgentRecord,
  InvitationRecord,
  JoinRequestRecord,
  MemberRecord,
  TeamRecord,
  TransferRecord,
} from '../domain/team.js';

type StoredMember = { -readonly [K in keyof MemberRecord]: MemberRecord[K] } & {
  teamId: string;
  leftAt: Date | null;
  leftReason: string | null;
};

export class InMemoryTeamRepository implements TeamRepository {
  readonly teams: TeamRecord[] = [];
  readonly members: StoredMember[] = [];
  readonly invitations: InvitationRecord[] = [];
  readonly joinRequests: JoinRequestRecord[] = [];
  readonly transfers: TransferRecord[] = [];
  readonly history: { teamId: string; name: string; tag: string; changedAt: Date }[] = [];
  readonly audit: { action: string; teamId: string; actorId: string; reason: string }[] = [];
  private sequence = 0;

  constructor(private readonly now: () => Date = () => new Date()) {}

  private nextId(): string {
    this.sequence += 1;
    return `00000000-0000-4000-9000-${String(this.sequence).padStart(12, '0')}`;
  }

  private assertUnique(organizationId: string, name: string, tag: string, exceptId?: string): void {
    const others = this.teams.filter(
      (t) => t.organizationId === organizationId && t.id !== exceptId,
    );
    if (others.some((t) => t.name.toLowerCase() === name.toLowerCase()))
      throw conflict('team_name_taken');
    if (others.some((t) => t.tag.toLowerCase() === tag.toLowerCase()))
      throw conflict('team_tag_taken');
  }

  private replace<T extends { id: string }>(list: T[], id: string, changes: Partial<T>): void {
    const index = list.findIndex((item) => item.id === id);
    const current = list[index];
    if (current) list[index] = { ...current, ...changes };
  }

  create(team: NewTeam): Promise<string> {
    this.assertUnique(team.organizationId, team.name, team.tag);
    if (this.teams.some((t) => t.organizationId === team.organizationId && t.slug === team.slug)) {
      return Promise.reject(conflict('team_slug_taken'));
    }
    const id = this.nextId();
    this.teams.push({ ...team, id, logoPath: null, status: 'active', createdAt: this.now() });
    this.members.push({
      teamId: id,
      userId: team.ownerUserId,
      teamRole: 'captain',
      gameRole: null,
      joinedAt: this.now(),
      leftAt: null,
      leftReason: null,
    });
    this.history.push({ teamId: id, name: team.name, tag: team.tag, changedAt: this.now() });
    return Promise.resolve(id);
  }

  findById(teamId: string): Promise<TeamRecord | null> {
    return Promise.resolve(this.teams.find((t) => t.id === teamId) ?? null);
  }

  findBySlug(organizationId: string, slug: string): Promise<TeamRecord | null> {
    return Promise.resolve(
      this.teams.find((t) => t.organizationId === organizationId && t.slug === slug) ?? null,
    );
  }

  slugExists(organizationId: string, slug: string): Promise<boolean> {
    return Promise.resolve(
      this.teams.some((t) => t.organizationId === organizationId && t.slug === slug),
    );
  }

  update(
    teamId: string,
    changes: Pick<TeamRecord, 'name' | 'tag' | 'region' | 'description'>,
  ): Promise<void> {
    const team = this.teams.find((t) => t.id === teamId);
    if (!team) return Promise.resolve();
    this.assertUnique(team.organizationId, changes.name, changes.tag, teamId);
    if (team.name !== changes.name || team.tag !== changes.tag) {
      this.history.push({ teamId, name: changes.name, tag: changes.tag, changedAt: this.now() });
    }
    this.replace(this.teams, teamId, changes);
    return Promise.resolve();
  }

  setLogoPath(teamId: string, path: string): Promise<string | null> {
    const previous = this.teams.find((t) => t.id === teamId)?.logoPath ?? null;
    this.replace(this.teams, teamId, { logoPath: path });
    return Promise.resolve(previous);
  }

  nameHistory(teamId: string) {
    return Promise.resolve(this.history.filter((h) => h.teamId === teamId).reverse());
  }

  private active(teamId: string): StoredMember[] {
    return this.members.filter((m) => m.teamId === teamId && m.leftAt === null);
  }

  activeMembers(teamId: string): Promise<MemberRecord[]> {
    return Promise.resolve(
      this.active(teamId).map(({ userId, teamRole, gameRole, joinedAt }) => ({
        userId,
        teamRole,
        gameRole,
        joinedAt,
      })),
    );
  }

  listActive(
    organizationId: string,
    { query, limit, offset }: { query: string; limit: number; offset: number },
  ) {
    const q = query.toLowerCase();
    const found = this.teams
      .filter(
        (t) =>
          t.organizationId === organizationId &&
          t.status === 'active' &&
          (t.name.toLowerCase().includes(q) || t.tag.toLowerCase().includes(q)),
      )
      .reverse();
    return Promise.resolve({ teams: found.slice(offset, offset + limit), total: found.length });
  }

  activeMemberCounts(teamIds: readonly string[]): Promise<Map<string, number>> {
    return Promise.resolve(new Map(teamIds.map((id) => [id, this.active(id).length])));
  }

  activeTeamsOf(userId: string) {
    return Promise.resolve(
      this.members
        .filter((m) => m.userId === userId && m.leftAt === null)
        .flatMap((m) => {
          const team = this.teams.find((t) => t.id === m.teamId);
          return team ? [{ team, role: m.teamRole }] : [];
        }),
    );
  }

  countTeamsCreatedBy(userId: string, organizationId: string): Promise<number> {
    return Promise.resolve(
      this.teams.filter(
        (t) =>
          t.ownerUserId === userId &&
          t.organizationId === organizationId &&
          t.status !== 'disbanded',
      ).length,
    );
  }

  countActiveCaptaincies(userId: string): Promise<number> {
    return Promise.resolve(
      this.members.filter(
        (m) => m.userId === userId && m.leftAt === null && m.teamRole === 'captain',
      ).length,
    );
  }

  addMember(input: {
    teamId: string;
    userId: string;
    teamRole: AssignableTeamRole;
    actorId: string;
    invitationId?: string;
    joinRequestId?: string;
  }): Promise<void> {
    if (this.active(input.teamId).some((m) => m.userId === input.userId))
      return Promise.reject(conflict('already_member'));
    this.members.push({
      teamId: input.teamId,
      userId: input.userId,
      teamRole: input.teamRole,
      gameRole: null,
      joinedAt: this.now(),
      leftAt: null,
      leftReason: null,
    });
    if (input.invitationId)
      this.replace(this.invitations, input.invitationId, { status: 'accepted' });
    if (input.joinRequestId)
      this.replace(this.joinRequests, input.joinRequestId, { status: 'approved' });
    for (const inv of this.invitations) {
      if (
        inv.teamId === input.teamId &&
        inv.invitedUserId === input.userId &&
        inv.status === 'pending'
      ) {
        this.replace(this.invitations, inv.id, { status: 'revoked' });
      }
    }
    return Promise.resolve();
  }

  updateMember(
    teamId: string,
    userId: string,
    changes: { teamRole?: AssignableTeamRole; gameRole?: PlayerRole | null },
  ): Promise<void> {
    const index = this.members.findIndex(
      (m) => m.teamId === teamId && m.userId === userId && m.leftAt === null,
    );
    const member = this.members[index];
    if (member) {
      this.members[index] = {
        ...member,
        ...(changes.teamRole ? { teamRole: changes.teamRole } : {}),
        ...(changes.gameRole === undefined ? {} : { gameRole: changes.gameRole }),
      };
    }
    return Promise.resolve();
  }

  removeMember(teamId: string, userId: string, reason: 'removed' | 'left'): Promise<void> {
    const index = this.members.findIndex(
      (m) => m.teamId === teamId && m.userId === userId && m.leftAt === null,
    );
    const member = this.members[index];
    if (member) this.members[index] = { ...member, leftAt: this.now(), leftReason: reason };
    return Promise.resolve();
  }

  dissolve(teamId: string, actorId: string, reason: string): Promise<void> {
    for (const member of this.active(teamId)) member.leftAt = this.now();
    this.replace(this.teams, teamId, { status: 'disbanded' });
    for (const inv of this.invitations.filter(
      (i) => i.teamId === teamId && i.status === 'pending',
    )) {
      this.replace(this.invitations, inv.id, { status: 'revoked' });
    }
    this.audit.push({ action: 'team.dissolved', teamId, actorId, reason });
    return Promise.resolve();
  }

  createInvitation(input: Omit<InvitationRecord, 'id' | 'status'>): Promise<InvitationRecord> {
    const duplicate = this.invitations.some(
      (i) =>
        i.teamId === input.teamId &&
        i.status === 'pending' &&
        input.invitedUserId !== null &&
        i.invitedUserId === input.invitedUserId,
    );
    if (duplicate) return Promise.reject(conflict('invitation_already_pending'));
    const invitation: InvitationRecord = { ...input, id: this.nextId(), status: 'pending' };
    this.invitations.push(invitation);
    return Promise.resolve(invitation);
  }

  findInvitation(invitationId: string) {
    return Promise.resolve(this.invitations.find((i) => i.id === invitationId) ?? null);
  }

  findInvitationByCode(code: string) {
    return Promise.resolve(this.invitations.find((i) => i.inviteCode === code) ?? null);
  }

  pendingInvitationsOfTeam(teamId: string) {
    return Promise.resolve(
      this.invitations.filter((i) => i.teamId === teamId && i.status === 'pending'),
    );
  }

  pendingInvitationsFor(userId: string) {
    return Promise.resolve(
      this.invitations.filter((i) => i.invitedUserId === userId && i.status === 'pending'),
    );
  }

  setInvitationStatus(
    invitationId: string,
    status: 'declined' | 'expired' | 'revoked',
  ): Promise<void> {
    this.replace(this.invitations, invitationId, { status });
    return Promise.resolve();
  }

  createJoinRequest(
    teamId: string,
    userId: string,
    message: string | null,
  ): Promise<JoinRequestRecord> {
    if (
      this.joinRequests.some(
        (r) => r.teamId === teamId && r.userId === userId && r.status === 'pending',
      )
    ) {
      return Promise.reject(conflict('join_request_already_pending'));
    }
    const request: JoinRequestRecord = {
      id: this.nextId(),
      teamId,
      userId,
      message,
      status: 'pending',
      createdAt: this.now(),
    };
    this.joinRequests.push(request);
    return Promise.resolve(request);
  }

  findJoinRequest(requestId: string) {
    return Promise.resolve(this.joinRequests.find((r) => r.id === requestId) ?? null);
  }

  pendingJoinRequests(teamId: string) {
    return Promise.resolve(
      this.joinRequests.filter((r) => r.teamId === teamId && r.status === 'pending'),
    );
  }

  declineJoinRequest(requestId: string): Promise<void> {
    this.replace(this.joinRequests, requestId, { status: 'declined' });
    return Promise.resolve();
  }

  createTransfer(teamId: string, fromUserId: string, toUserId: string): Promise<TransferRecord> {
    if (this.transfers.some((t) => t.teamId === teamId && t.status === 'pending')) {
      return Promise.reject(conflict('transfer_already_pending'));
    }
    const transfer: TransferRecord = {
      id: this.nextId(),
      teamId,
      fromUserId,
      toUserId,
      status: 'pending',
      createdAt: this.now(),
    };
    this.transfers.push(transfer);
    return Promise.resolve(transfer);
  }

  pendingTransfer(teamId: string) {
    return Promise.resolve(
      this.transfers.find((t) => t.teamId === teamId && t.status === 'pending') ?? null,
    );
  }

  findTransfer(transferId: string) {
    return Promise.resolve(this.transfers.find((t) => t.id === transferId) ?? null);
  }

  acceptTransfer(transferId: string, reason: string): Promise<void> {
    const transfer = this.transfers.find((t) => t.id === transferId);
    if (!transfer) return Promise.resolve();
    for (const member of this.active(transfer.teamId)) {
      if (member.userId === transfer.fromUserId) member.teamRole = 'co_captain';
      if (member.userId === transfer.toUserId) member.teamRole = 'captain';
    }
    this.replace(this.teams, transfer.teamId, { ownerUserId: transfer.toUserId });
    this.replace(this.transfers, transferId, { status: 'accepted' });
    this.audit.push({
      action: 'team.captaincy.transferred',
      teamId: transfer.teamId,
      actorId: transfer.toUserId,
      reason,
    });
    return Promise.resolve();
  }

  closeTransfer(transferId: string, status: 'declined' | 'canceled'): Promise<void> {
    this.replace(this.transfers, transferId, { status });
    return Promise.resolve();
  }
}

export class InMemoryFreeAgentRepository implements FreeAgentRepository {
  readonly listings = new Map<string, FreeAgentRecord & { active: boolean }>();

  find(userId: string, organizationId: string): Promise<FreeAgentRecord | null> {
    return Promise.resolve(this.listings.get(`${userId}:${organizationId}`) ?? null);
  }

  save(
    userId: string,
    organizationId: string,
    listing: FreeAgentRecord,
    active: boolean,
  ): Promise<void> {
    this.listings.set(`${userId}:${organizationId}`, { ...listing, active });
    return Promise.resolve();
  }
}
