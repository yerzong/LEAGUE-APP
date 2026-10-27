import type { AssignableTeamRole, PlayerRole } from '@league/contracts';
import type { Tables } from '@league/db';
import type { PostgrestError } from '@supabase/supabase-js';

import { conflict, notFound } from '../../../shared/application-error.js';
import {
  assertNoError,
  isUniqueViolation,
  raisedCode,
} from '../../../shared/database/postgres-errors.js';
import { likeEscape } from '../../../shared/database/like-escape.js';
import type { AdminClient } from '../../../shared/database/supabase-admin.js';
import type { FreeAgentRepository, NewTeam, TeamRepository } from '../application/ports.js';
import type {
  FreeAgentRecord,
  InvitationRecord,
  JoinRequestRecord,
  MemberRecord,
  TeamRecord,
  TransferRecord,
} from '../domain/team.js';

const UNIQUE_CODES: readonly [string, string][] = [
  ['teams_name_per_org_key', 'team_name_taken'],
  ['teams_tag_per_org_key', 'team_tag_taken'],
  ['teams_organization_id_slug_key', 'team_slug_taken'],
  ['team_members_active_key', 'already_member'],
  ['team_members_one_captain_key', 'captain_not_assignable'],
  ['team_invitations_pending_user_key', 'invitation_already_pending'],
  ['team_join_requests_pending_key', 'join_request_already_pending'],
  ['team_captaincy_transfers_pending_key', 'transfer_already_pending'],
];

/** Maps unique violations to their domain code, then fails on anything else. */
function check(error: PostgrestError | null): void {
  for (const [constraint, code] of UNIQUE_CODES) {
    if (isUniqueViolation(error, constraint)) throw conflict(code);
  }
  const raised = raisedCode(error);
  if (raised) throw conflict(raised);
  assertNoError(error);
}

const toTeam = (row: Tables<'teams'>): TeamRecord => ({
  id: row.id,
  organizationId: row.organization_id,
  slug: row.slug,
  name: row.name,
  tag: row.tag,
  region: row.region,
  description: row.description,
  logoPath: row.logo_path,
  status: row.status,
  ownerUserId: row.owner_user_id,
  createdAt: new Date(row.created_at),
});

const toMember = (
  row: Pick<Tables<'team_members'>, 'user_id' | 'team_role' | 'game_role' | 'joined_at'>,
): MemberRecord => ({
  userId: row.user_id,
  teamRole: row.team_role,
  gameRole: row.game_role,
  joinedAt: new Date(row.joined_at),
});

const toInvitation = (row: Tables<'team_invitations'>): InvitationRecord => ({
  id: row.id,
  teamId: row.team_id,
  invitedUserId: row.invited_user_id,
  inviteCode: row.invite_code,
  // The table forbids captain invitations.
  teamRole: row.team_role as AssignableTeamRole,
  status: row.status,
  expiresAt: new Date(row.expires_at),
  createdBy: row.created_by,
});

const toJoinRequest = (row: Tables<'team_join_requests'>): JoinRequestRecord => ({
  id: row.id,
  teamId: row.team_id,
  userId: row.user_id,
  message: row.message,
  status: row.status,
  createdAt: new Date(row.created_at),
});

const toTransfer = (row: Tables<'team_captaincy_transfers'>): TransferRecord => ({
  id: row.id,
  teamId: row.team_id,
  fromUserId: row.from_user_id,
  toUserId: row.to_user_id,
  status: row.status,
  createdAt: new Date(row.created_at),
});

export class SupabaseTeamRepository implements TeamRepository {
  constructor(private readonly db: AdminClient) {}

  async create(team: NewTeam): Promise<string> {
    const { data, error } = await this.db.rpc('svc_create_team', {
      p_organization_id: team.organizationId,
      p_owner_user_id: team.ownerUserId,
      p_name: team.name,
      p_tag: team.tag,
      p_slug: team.slug,
      p_region: team.region,
      // The generated type marks it required; SQL accepts null.
      p_description: team.description as string,
    });
    check(error);
    return data as string;
  }

  async findById(teamId: string): Promise<TeamRecord | null> {
    const { data, error } = await this.db
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .is('deleted_at', null)
      .maybeSingle();
    check(error);
    return data ? toTeam(data) : null;
  }

  async findBySlug(organizationId: string, slug: string): Promise<TeamRecord | null> {
    const { data, error } = await this.db
      .from('teams')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('slug', slug)
      .is('deleted_at', null)
      .maybeSingle();
    check(error);
    return data ? toTeam(data) : null;
  }

  async slugExists(organizationId: string, slug: string): Promise<boolean> {
    const { count, error } = await this.db
      .from('teams')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('slug', slug);
    check(error);
    return (count ?? 0) > 0;
  }

  async update(
    teamId: string,
    changes: Pick<TeamRecord, 'name' | 'tag' | 'region' | 'description'>,
    actorId: string,
  ): Promise<void> {
    const { error } = await this.db
      .from('teams')
      .update({ ...changes, updated_by: actorId })
      .eq('id', teamId);
    check(error);
  }

  async setLogoPath(teamId: string, path: string, actorId: string): Promise<string | null> {
    const previous = await this.findById(teamId);
    const { error } = await this.db
      .from('teams')
      .update({ logo_path: path, updated_by: actorId })
      .eq('id', teamId);
    check(error);
    return previous?.logoPath ?? null;
  }

  async nameHistory(teamId: string): Promise<{ name: string; tag: string; changedAt: Date }[]> {
    const { data, error } = await this.db
      .from('team_name_history')
      .select('name, tag, changed_at')
      .eq('team_id', teamId)
      .order('changed_at', { ascending: false });
    check(error);
    return (data ?? []).map((h) => ({
      name: h.name,
      tag: h.tag,
      changedAt: new Date(h.changed_at),
    }));
  }

  async activeMembers(teamId: string): Promise<MemberRecord[]> {
    const { data, error } = await this.db
      .from('team_members')
      .select('user_id, team_role, game_role, joined_at')
      .eq('team_id', teamId)
      .is('left_at', null)
      .order('joined_at');
    check(error);
    return (data ?? []).map(toMember);
  }

  async listActive(
    organizationId: string,
    { query, limit, offset }: { query: string; limit: number; offset: number },
  ): Promise<{ teams: TeamRecord[]; total: number }> {
    let select = this.db
      .from('teams')
      .select('*', { count: 'exact' })
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .is('deleted_at', null);
    // The contract only lets letters, digits, spaces and `_ . -` through.
    if (query !== '') {
      const pattern = `*${likeEscape(query)}*`;
      select = select.or(`name.ilike.${pattern},tag.ilike.${pattern}`);
    }
    const { data, count, error } = await select
      .order('created_at', { ascending: false })
      .order('id')
      .range(offset, offset + limit - 1);
    check(error);
    return { teams: (data ?? []).map(toTeam), total: count ?? 0 };
  }

  async activeMemberCounts(teamIds: readonly string[]): Promise<Map<string, number>> {
    const counts = new Map(teamIds.map((id) => [id, 0]));
    if (teamIds.length === 0) return counts;
    const { data, error } = await this.db
      .from('team_members')
      .select('team_id')
      .in('team_id', [...teamIds])
      .is('left_at', null);
    check(error);
    for (const row of data ?? []) counts.set(row.team_id, (counts.get(row.team_id) ?? 0) + 1);
    return counts;
  }

  async activeTeamsOf(
    userId: string,
  ): Promise<{ team: TeamRecord; role: MemberRecord['teamRole'] }[]> {
    const { data, error } = await this.db
      .from('team_members')
      .select('team_role, teams!inner(*)')
      .eq('user_id', userId)
      .is('left_at', null)
      .is('teams.deleted_at', null)
      .order('joined_at');
    check(error);
    return (data ?? []).map((row) => ({ team: toTeam(row.teams), role: row.team_role }));
  }

  async countTeamsCreatedBy(userId: string, organizationId: string): Promise<number> {
    const { count, error } = await this.db
      .from('teams')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', userId)
      .eq('organization_id', organizationId)
      .eq('kind', 'permanent')
      .neq('status', 'disbanded');
    check(error);
    return count ?? 0;
  }

  async countActiveCaptaincies(userId: string): Promise<number> {
    const { count, error } = await this.db
      .from('team_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('team_role', 'captain')
      .is('left_at', null);
    check(error);
    return count ?? 0;
  }

  async addMember(input: {
    teamId: string;
    userId: string;
    teamRole: AssignableTeamRole;
    actorId: string;
    invitationId?: string;
    joinRequestId?: string;
  }): Promise<void> {
    const { error } = await this.db.rpc('svc_add_team_member', {
      p_team_id: input.teamId,
      p_user_id: input.userId,
      p_team_role: input.teamRole,
      p_actor: input.actorId,
      ...(input.invitationId ? { p_invitation_id: input.invitationId } : {}),
      ...(input.joinRequestId ? { p_join_request_id: input.joinRequestId } : {}),
    });
    if (raisedCode(error) === 'invitation_not_pending') throw conflict('invitation_not_pending');
    if (raisedCode(error) === 'join_request_not_pending') throw notFound('join_request_not_found');
    check(error);
  }

  async updateMember(
    teamId: string,
    userId: string,
    changes: { teamRole?: AssignableTeamRole; gameRole?: PlayerRole | null },
    actorId: string,
  ): Promise<void> {
    const { error } = await this.db
      .from('team_members')
      .update({
        ...(changes.teamRole ? { team_role: changes.teamRole } : {}),
        ...(changes.gameRole === undefined ? {} : { game_role: changes.gameRole }),
        updated_by: actorId,
      })
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .is('left_at', null);
    check(error);
  }

  async removeMember(
    teamId: string,
    userId: string,
    reason: 'removed' | 'left',
    actorId: string,
  ): Promise<void> {
    const { error } = await this.db
      .from('team_members')
      .update({ left_at: new Date().toISOString(), left_reason: reason, updated_by: actorId })
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .is('left_at', null);
    check(error);
  }

  async dissolve(teamId: string, actorId: string, reason: string): Promise<void> {
    const { error } = await this.db.rpc('svc_dissolve_team', {
      p_team_id: teamId,
      p_actor: actorId,
      p_reason: reason,
    });
    check(error);
  }

  async createInvitation(
    input: Omit<InvitationRecord, 'id' | 'status'>,
  ): Promise<InvitationRecord> {
    const { data, error } = await this.db
      .from('team_invitations')
      .insert({
        team_id: input.teamId,
        invited_user_id: input.invitedUserId,
        invite_code: input.inviteCode,
        team_role: input.teamRole,
        expires_at: input.expiresAt.toISOString(),
        created_by: input.createdBy,
      })
      .select('*')
      .single();
    check(error);
    return toInvitation(data as Tables<'team_invitations'>);
  }

  async findInvitation(invitationId: string): Promise<InvitationRecord | null> {
    const { data, error } = await this.db
      .from('team_invitations')
      .select('*')
      .eq('id', invitationId)
      .maybeSingle();
    check(error);
    return data ? toInvitation(data) : null;
  }

  async findInvitationByCode(code: string): Promise<InvitationRecord | null> {
    const { data, error } = await this.db
      .from('team_invitations')
      .select('*')
      .eq('invite_code', code)
      .maybeSingle();
    check(error);
    return data ? toInvitation(data) : null;
  }

  async pendingInvitationsOfTeam(teamId: string): Promise<InvitationRecord[]> {
    const { data, error } = await this.db
      .from('team_invitations')
      .select('*')
      .eq('team_id', teamId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at');
    check(error);
    return (data ?? []).map(toInvitation);
  }

  async pendingInvitationsFor(userId: string): Promise<InvitationRecord[]> {
    const { data, error } = await this.db
      .from('team_invitations')
      .select('*')
      .eq('invited_user_id', userId)
      .eq('status', 'pending')
      .order('created_at');
    check(error);
    return (data ?? []).map(toInvitation);
  }

  async setInvitationStatus(
    invitationId: string,
    status: 'declined' | 'expired' | 'revoked',
  ): Promise<void> {
    const { error } = await this.db
      .from('team_invitations')
      .update({ status, decided_at: new Date().toISOString() })
      .eq('id', invitationId)
      .eq('status', 'pending');
    check(error);
  }

  async createJoinRequest(
    teamId: string,
    userId: string,
    message: string | null,
  ): Promise<JoinRequestRecord> {
    const { data, error } = await this.db
      .from('team_join_requests')
      .insert({ team_id: teamId, user_id: userId, message })
      .select('*')
      .single();
    check(error);
    return toJoinRequest(data as Tables<'team_join_requests'>);
  }

  async findJoinRequest(requestId: string): Promise<JoinRequestRecord | null> {
    const { data, error } = await this.db
      .from('team_join_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();
    check(error);
    return data ? toJoinRequest(data) : null;
  }

  async pendingJoinRequests(teamId: string): Promise<JoinRequestRecord[]> {
    const { data, error } = await this.db
      .from('team_join_requests')
      .select('*')
      .eq('team_id', teamId)
      .eq('status', 'pending')
      .order('created_at');
    check(error);
    return (data ?? []).map(toJoinRequest);
  }

  async declineJoinRequest(requestId: string, actorId: string): Promise<void> {
    const { error } = await this.db
      .from('team_join_requests')
      .update({ status: 'declined', decided_by: actorId, decided_at: new Date().toISOString() })
      .eq('id', requestId)
      .eq('status', 'pending');
    check(error);
  }

  async createTransfer(
    teamId: string,
    fromUserId: string,
    toUserId: string,
  ): Promise<TransferRecord> {
    const { data, error } = await this.db
      .from('team_captaincy_transfers')
      .insert({ team_id: teamId, from_user_id: fromUserId, to_user_id: toUserId })
      .select('*')
      .single();
    check(error);
    return toTransfer(data as Tables<'team_captaincy_transfers'>);
  }

  async pendingTransfer(teamId: string): Promise<TransferRecord | null> {
    const { data, error } = await this.db
      .from('team_captaincy_transfers')
      .select('*')
      .eq('team_id', teamId)
      .eq('status', 'pending')
      .maybeSingle();
    check(error);
    return data ? toTransfer(data) : null;
  }

  async findTransfer(transferId: string): Promise<TransferRecord | null> {
    const { data, error } = await this.db
      .from('team_captaincy_transfers')
      .select('*')
      .eq('id', transferId)
      .maybeSingle();
    check(error);
    return data ? toTransfer(data) : null;
  }

  async acceptTransfer(transferId: string, reason: string): Promise<void> {
    const { error } = await this.db.rpc('svc_accept_captaincy_transfer', {
      p_transfer_id: transferId,
      p_reason: reason,
    });
    check(error);
  }

  async closeTransfer(transferId: string, status: 'declined' | 'canceled'): Promise<void> {
    const { error } = await this.db
      .from('team_captaincy_transfers')
      .update({ status, decided_at: new Date().toISOString() })
      .eq('id', transferId)
      .eq('status', 'pending');
    check(error);
  }
}

export class SupabaseFreeAgentRepository implements FreeAgentRepository {
  constructor(private readonly db: AdminClient) {}

  async find(userId: string, organizationId: string): Promise<FreeAgentRecord | null> {
    const { data, error } = await this.db
      .from('free_agent_listings')
      .select('roles, message, availability, active_until')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .maybeSingle();
    check(error);
    if (!data) return null;
    return {
      roles: data.roles,
      message: data.message,
      // Written only through FreeAgentAvailabilitySchema.
      availability: data.availability as unknown as FreeAgentRecord['availability'],
      activeUntil: new Date(data.active_until),
    };
  }

  async save(
    userId: string,
    organizationId: string,
    listing: FreeAgentRecord,
    active: boolean,
  ): Promise<void> {
    const { error } = await this.db.from('free_agent_listings').upsert(
      {
        user_id: userId,
        organization_id: organizationId,
        roles: [...listing.roles],
        message: listing.message,
        availability: listing.availability,
        active_until: listing.activeUntil.toISOString(),
      },
      { onConflict: 'user_id,organization_id' },
    );
    check(error);
    const flag = await this.db.from('users').update({ is_free_agent: active }).eq('id', userId);
    check(flag.error);
  }
}
