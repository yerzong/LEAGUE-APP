// Postgres adapter of RecipientDirectory: reads registrations, rosters, teams,
// matches and staff to know who an event concerns. Only active accounts are
// recipients; email addresses come from Auth when sending and are never stored.
import type { NotificationCategory } from '@league/contracts';

import { assertNoError } from '../../../shared/database/postgres-errors.js';
import type { AdminClient } from '../../../shared/database/supabase-admin.js';
import type { EventContext, RecipientDirectory, RecipientProfile } from '../application/ports.js';
import type { OutboxEvent } from '../domain/notification.js';

const CHUNK = 100;
const MANAGERS = ['captain', 'co_captain'] as const;

const chunks = <T>(list: readonly T[]): T[][] =>
  Array.from({ length: Math.ceil(list.length / CHUNK) }, (_, i) =>
    list.slice(i * CHUNK, (i + 1) * CHUNK),
  );

export class SupabaseRecipientDirectory implements RecipientDirectory {
  constructor(private readonly db: AdminClient) {}

  async contextOf(event: OutboxEvent): Promise<EventContext | null> {
    if (!event.organizationId) return null;
    let tournamentId: string | null = null;
    let entrant: EventContext['entrant'] = null;
    let match: EventContext['match'] = null;

    if (event.aggregateType === 'tournament') tournamentId = event.aggregateId;
    if (event.aggregateType === 'entrant') {
      const { data, error } = await this.db
        .from('entrants')
        .select('id, tournament_id, display_name, rejection_reason')
        .eq('id', event.aggregateId)
        .maybeSingle();
      assertNoError(error);
      if (!data) return null;
      tournamentId = data.tournament_id;
      entrant = { id: data.id, name: data.display_name, reason: data.rejection_reason };
    }
    if (event.aggregateType === 'match') {
      const { data, error } = await this.db
        .from('matches')
        .select('id, tournament_id, scheduled_at, entrant_a_id, entrant_b_id, winner_entrant_id')
        .eq('id', event.aggregateId)
        .maybeSingle();
      assertNoError(error);
      if (!data) return null;
      tournamentId = data.tournament_id;
      const names = await this.entrantNames(
        [data.entrant_a_id, data.entrant_b_id].filter((id): id is string => id !== null),
      );
      const side = (id: string | null) =>
        id && names.has(id) ? { id, name: names.get(id) ?? '' } : null;
      match = {
        id: data.id,
        scheduledAt: data.scheduled_at ? new Date(data.scheduled_at) : null,
        entrantA: side(data.entrant_a_id),
        entrantB: side(data.entrant_b_id),
        winnerId: data.winner_entrant_id,
      };
    }
    if (!tournamentId) return null;

    const [tournament, organization] = await Promise.all([
      this.db
        .from('tournaments')
        .select('id, name, slug, timezone')
        .eq('id', tournamentId)
        .is('deleted_at', null)
        .maybeSingle(),
      this.db.from('organizations').select('id, name').eq('id', event.organizationId).maybeSingle(),
    ]);
    assertNoError(tournament.error);
    assertNoError(organization.error);
    if (!tournament.data || !organization.data) return null;
    return { organization: organization.data, tournament: tournament.data, entrant, match };
  }

  private async entrantNames(ids: readonly string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const { data, error } = await this.db.from('entrants').select('id, display_name').in('id', ids);
    assertNoError(error);
    return new Map((data ?? []).map((e) => [e.id, e.display_name]));
  }

  async membersOf(entrantIds: readonly string[]): Promise<Map<string, string[]>> {
    const result = new Map<string, Set<string>>(entrantIds.map((id) => [id, new Set()]));
    for (const ids of chunks([...new Set(entrantIds)])) {
      const [entrants, roster] = await Promise.all([
        this.db.from('entrants').select('id, team_id, user_id, registered_by').in('id', ids),
        this.db.from('entrant_roster_members').select('entrant_id, user_id').in('entrant_id', ids),
      ]);
      assertNoError(entrants.error);
      assertNoError(roster.error);
      // The roster as registered (a rejection removes it; it still has to hear about it).
      for (const r of roster.data ?? []) result.get(r.entrant_id)?.add(r.user_id);
      const teamIds = [
        ...new Set((entrants.data ?? []).flatMap((e) => (e.team_id ? [e.team_id] : []))),
      ];
      const { data: managers, error } = teamIds.length
        ? await this.db
            .from('team_members')
            .select('team_id, user_id')
            .in('team_id', teamIds)
            .in('team_role', [...MANAGERS])
            .is('left_at', null)
        : { data: [], error: null };
      assertNoError(error);
      for (const e of entrants.data ?? []) {
        const members = result.get(e.id);
        if (!members) continue;
        members.add(e.registered_by);
        if (e.user_id) members.add(e.user_id);
        for (const m of managers ?? []) if (m.team_id === e.team_id) members.add(m.user_id);
      }
    }
    const active = await this.activeUsers([...result.values()].flatMap((s) => [...s]));
    return new Map([...result].map(([id, users]) => [id, [...users].filter((u) => active.has(u))]));
  }

  private async activeUsers(userIds: readonly string[]): Promise<Set<string>> {
    const active = new Set<string>();
    for (const ids of chunks([...new Set(userIds)])) {
      const { data, error } = await this.db
        .from('users')
        .select('id')
        .in('id', ids)
        .eq('status', 'active')
        .is('deleted_at', null);
      assertNoError(error);
      for (const u of data ?? []) active.add(u.id);
    }
    return active;
  }

  async approvedEntrants(tournamentId: string): Promise<{ id: string; name: string }[]> {
    const { data, error } = await this.db
      .from('entrants')
      .select('id, display_name')
      .eq('tournament_id', tournamentId)
      .eq('status', 'approved');
    assertNoError(error);
    return (data ?? []).map((e) => ({ id: e.id, name: e.display_name }));
  }

  async staffOf(tournamentId: string): Promise<string[]> {
    const [admins, staff] = await Promise.all([
      this.db
        .from('users')
        .select('id')
        .eq('platform_role', 'super_admin')
        .eq('status', 'active')
        .is('deleted_at', null),
      this.db.from('tournament_staff').select('user_id').eq('tournament_id', tournamentId),
    ]);
    assertNoError(admins.error);
    assertNoError(staff.error);
    const ids = [
      ...(admins.data ?? []).map((u) => u.id),
      ...(staff.data ?? []).map((s) => s.user_id),
    ];
    const active = await this.activeUsers(ids);
    return [...new Set(ids)].filter((id) => active.has(id));
  }

  async followersOf(
    entrantIds: readonly string[],
    tournamentId: string,
  ): Promise<{ userId: string; entrantId: string | null }[]> {
    const { data: entrants, error } = await this.db
      .from('entrants')
      .select('id, team_id, user_id')
      .in('id', [...entrantIds]);
    assertNoError(error);
    const targets = [
      ...(entrants ?? []).map((e) =>
        e.team_id
          ? { type: 'team' as const, id: e.team_id, entrantId: e.id }
          : { type: 'user' as const, id: e.user_id ?? '', entrantId: e.id },
      ),
      { type: 'tournament' as const, id: tournamentId, entrantId: null },
    ].filter((t) => t.id !== '');
    const found: { userId: string; entrantId: string | null }[] = [];
    for (const t of targets) {
      const { data, error: followsError } = await this.db
        .from('follows')
        .select('follower_user_id')
        .eq('followable_type', t.type)
        .eq('followable_id', t.id);
      assertNoError(followsError);
      for (const f of data ?? [])
        found.push({ userId: f.follower_user_id, entrantId: t.entrantId });
    }
    const active = await this.activeUsers(found.map((f) => f.userId));
    return found.filter((f) => active.has(f.userId));
  }

  async optedIn(category: NotificationCategory): Promise<string[]> {
    const { data, error } = await this.db
      .from('user_notification_preferences')
      .select('user_id')
      .eq('category', category)
      .eq('enabled', true);
    assertNoError(error);
    const ids = [...new Set((data ?? []).map((p) => p.user_id))];
    const active = await this.activeUsers(ids);
    return ids.filter((id) => active.has(id));
  }

  async profiles(userIds: readonly string[]): Promise<Map<string, RecipientProfile>> {
    const result = new Map<string, RecipientProfile>();
    for (const ids of chunks([...new Set(userIds)])) {
      const { data, error } = await this.db
        .from('users')
        .select('id, username, display_name, locale')
        .in('id', ids);
      assertNoError(error);
      for (const u of data ?? [])
        result.set(u.id, { username: u.username, displayName: u.display_name, locale: u.locale });
    }
    return result;
  }

  async emailOf(userId: string): Promise<string | null> {
    const { data, error } = await this.db.auth.admin.getUserById(userId);
    if (error) throw new Error(`Auth lookup failed (${String(error.status ?? 'unknown')})`);
    return data.user.email ?? null;
  }

  async organizationName(organizationId: string | null): Promise<string> {
    if (!organizationId) return '';
    const { data, error } = await this.db
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .maybeSingle();
    assertNoError(error);
    return data?.name ?? '';
  }
}
