// Postgres adapter of RegistrationRepository: the svc_* functions keep the
// entrant, its roster, the audit log and the outbox in one transaction; the
// unique indexes are the last line of defence (one registration per team, one
// roster per player and exclusivity scope).
import type { EntrantStatus } from '@league/contracts';
import type { RosterMembership } from '@league/core';
import type { Json, Tables } from '@league/db';

import { ApplicationError, conflict } from '../../../shared/application-error.js';
import {
  assertNoError,
  isUniqueViolation,
  raisedCode,
} from '../../../shared/database/postgres-errors.js';
import type { AdminClient } from '../../../shared/database/supabase-admin.js';
import type { NewEntrant, RegistrationRepository } from '../application/ports.js';
import type { EntrantRecord, RosterRecord } from '../domain/registration.js';

type Row = Tables<'entrants'> & { entrant_roster_members: Tables<'entrant_roster_members'>[] };

const raisedConflicts = new Set([
  'registration_closed',
  'tournament_full',
  'registration_not_found',
  'registration_status_changed',
  'seeding_changed',
]);

function check(error: Parameters<typeof raisedCode>[0]): void {
  const code = raisedCode(error);
  if (code && raisedConflicts.has(code)) throw new ApplicationError('conflict', code);
  assertNoError(error);
}

const toRecord = (row: Row): EntrantRecord => ({
  id: row.id,
  tournamentId: row.tournament_id,
  teamId: row.team_id,
  userId: row.user_id,
  displayName: row.display_name,
  displayTag: row.display_tag,
  logoPath: row.logo_path,
  status: row.status,
  seed: row.seed,
  waitlistPosition: row.waitlist_position,
  rejectionReason: row.rejection_reason,
  rulebookVersionId: row.rulebook_version_id,
  registeredBy: row.registered_by,
  createdAt: new Date(row.created_at),
  roster: row.entrant_roster_members
    .filter((m) => m.removed_at === null)
    .sort((a, b) => a.added_at.localeCompare(b.added_at) || a.id.localeCompare(b.id))
    .map((m): RosterRecord => ({
      userId: m.user_id,
      riotAccountId: m.riot_account_id,
      role: m.roster_role,
      gameRole: m.game_role,
      exclusivityKey: m.exclusivity_key,
    })),
});

const SELECT = '*, entrant_roster_members(*)';

export class SupabaseRegistrationRepository implements RegistrationRepository {
  constructor(private readonly db: AdminClient) {}

  async register(input: {
    tournamentId: string;
    actorId: string;
    entrant: NewEntrant;
    roster: readonly RosterRecord[];
  }): Promise<string> {
    const { entrant } = input;
    const { data, error } = await this.db.rpc('svc_register_entrant', {
      p_tournament_id: input.tournamentId,
      p_actor: input.actorId,
      p_entrant: {
        team_id: entrant.teamId,
        user_id: entrant.userId,
        display_name: entrant.displayName,
        display_tag: entrant.displayTag,
        logo_path: entrant.logoPath,
        rulebook_version_id: entrant.rulebookVersionId,
        check_eligibility_result: entrant.eligibility as Json,
      },
      p_roster: input.roster.map((r) => ({
        user_id: r.userId,
        riot_account_id: r.riotAccountId,
        roster_role: r.role,
        game_role: r.gameRole,
        exclusivity_key: r.exclusivityKey,
      })),
    });
    if (
      isUniqueViolation(error, 'entrants_team_per_tournament_key') ||
      isUniqueViolation(error, 'entrants_solo_per_tournament_key')
    )
      throw conflict('already_registered');
    if (isUniqueViolation(error, 'entrant_roster_members_exclusivity_key'))
      throw conflict('exclusivity_conflict');
    check(error);
    return data as string;
  }

  async find(entrantId: string): Promise<EntrantRecord | null> {
    const { data, error } = await this.db
      .from('entrants')
      .select(SELECT)
      .eq('id', entrantId)
      .maybeSingle();
    check(error);
    return data ? toRecord(data) : null;
  }

  async listByTournament(tournamentId: string): Promise<EntrantRecord[]> {
    const { data, error } = await this.db
      .from('entrants')
      .select(SELECT)
      .eq('tournament_id', tournamentId)
      .order('created_at')
      .order('id');
    check(error);
    return ((data ?? []) as Row[]).map(toRecord);
  }

  async involving(teamIds: readonly string[], userId: string): Promise<EntrantRecord[]> {
    // Ids are UUIDs from our own tables (no user text in the filter).
    const filters = [`user_id.eq.${userId}`, `registered_by.eq.${userId}`];
    if (teamIds.length > 0) filters.push(`team_id.in.(${teamIds.join(',')})`);
    const { data, error } = await this.db
      .from('entrants')
      .select(SELECT)
      .or(filters.join(','))
      .order('created_at', { ascending: false });
    check(error);
    return ((data ?? []) as Row[]).map(toRecord);
  }

  async decide(
    entrantId: string,
    actorId: string,
    change: {
      from: EntrantStatus;
      to: EntrantStatus;
      auditAction: string | null;
      event: string;
      reason: string | null;
    },
  ): Promise<void> {
    const { error } = await this.db.rpc('svc_decide_entrant', {
      p_entrant_id: entrantId,
      p_actor: actorId,
      p_from: change.from,
      p_to: change.to,
      // The generated types mark these required; SQL accepts null.
      p_audit_action: change.auditAction as string,
      p_event_type: change.event,
      p_reason: change.reason as string,
    });
    check(error);
  }

  async setSeeds(
    tournamentId: string,
    actorId: string,
    method: string,
    seeds: readonly { entrantId: string; seed: number }[],
  ): Promise<void> {
    const { error } = await this.db.rpc('svc_set_seeds', {
      p_tournament_id: tournamentId,
      p_actor: actorId,
      p_method: method,
      p_seeds: seeds.map((s) => ({ entrant_id: s.entrantId, seed: s.seed })),
    });
    check(error);
  }

  async counts(
    tournamentIds: readonly string[],
  ): Promise<Map<string, { pending: number; approved: number; waitlisted: number }>> {
    const counts = new Map(
      tournamentIds.map((id) => [id, { pending: 0, approved: 0, waitlisted: 0 }]),
    );
    if (tournamentIds.length === 0) return counts;
    const { data, error } = await this.db
      .from('entrants')
      .select('tournament_id, status')
      .in('tournament_id', [...tournamentIds])
      .in('status', ['pending', 'approved', 'waitlisted']);
    check(error);
    for (const row of data ?? []) {
      const entry = counts.get(row.tournament_id);
      if (
        entry &&
        (row.status === 'pending' || row.status === 'approved' || row.status === 'waitlisted')
      )
        entry[row.status] += 1;
    }
    return counts;
  }

  async activeRostersOf(userIds: readonly string[]): Promise<Map<string, RosterMembership[]>> {
    const map = new Map<string, RosterMembership[]>(userIds.map((u) => [u, []]));
    if (userIds.length === 0) return map;
    const { data, error } = await this.db
      .from('entrant_roster_members')
      .select(
        'user_id, added_at, entrants!inner(id, team_id, tournament_id, status, tournaments!inner(season_id, tier, circuit_tournaments(circuit_id)))',
      )
      .in('user_id', [...userIds])
      .is('removed_at', null)
      .in('entrants.status', ['pending', 'approved', 'waitlisted']);
    check(error);
    for (const row of data ?? []) {
      const entrant = row.entrants;
      const tournament = entrant.tournaments;
      const circuits = tournament.circuit_tournaments as
        { circuit_id: string }[] | { circuit_id: string } | null;
      const circuitId = Array.isArray(circuits)
        ? (circuits[0]?.circuit_id ?? null)
        : (circuits?.circuit_id ?? null);
      map.get(row.user_id)?.push({
        entrantId: entrant.id,
        teamId: entrant.team_id,
        tournamentId: entrant.tournament_id,
        seasonId: tournament.season_id,
        circuitId,
        tier: tournament.tier as 1 | 2 | 3,
        joinedAt: row.added_at,
        leftAt: null,
      });
    }
    return map;
  }
}
