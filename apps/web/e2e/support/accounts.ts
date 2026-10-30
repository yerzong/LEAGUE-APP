// Test users for the flows that need a database. Created confirmed through the
// Auth admin API (secret key, test process only) and deleted afterwards.
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const API = 'http://localhost:4000';

/** False without a real Supabase project: those flows are skipped. */
export const hasDatabase = Boolean(
  url && publishableKey && secretKey && !secretKey.endsWith('_e2e'),
);

export interface TestAccount {
  id: string;
  email: string;
  password: string;
  token: string;
}

function admin() {
  if (!url || !secretKey) throw new Error('E2E database env missing');
  return createClient(url, secretKey, { auth: { persistSession: false } });
}

/** A short unique suffix per run, safe for usernames, team names and Riot IDs. */
export const runId = Date.now().toString(36).slice(-6);

export async function createAccount(name: string): Promise<TestAccount> {
  const email = `e2e-${name}-${runId}@example.com`;
  const password = `E2e-${runId}-pass!`;
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const client = createClient(url ?? '', publishableKey ?? '', { auth: { persistSession: false } });
  const { data: session, error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw signInError;
  return { id: data.user.id, email, password, token: session.session.access_token };
}

/** Direct API call as a test user, to prepare state the flow under test does not cover. */
export async function api(
  account: TestAccount,
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${account.token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok)
    throw new Error(`${method} ${path}: ${String(response.status)} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

/**
 * The staff account of the E2E runs. Approving, publishing or canceling is
 * written to the append-only audit log, whose actor cannot be deleted, so this
 * account is kept between runs (no username: it never shows in /jugadores).
 */
export async function staffAccount(): Promise<TestAccount> {
  const email = 'e2e-staff@example.com';
  const password = `E2e-staff-${runId}-pass!`;
  const db = admin();
  const { data: list, error: listError } = await db.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw listError;
  let id = list.users.find((u) => u.email === email)?.id;
  if (id) {
    const { error } = await db.auth.admin.updateUserById(id, { password });
    if (error) throw error;
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    id = data.user.id;
  }
  const { error: roleError } = await db
    .from('users')
    .update({ platform_role: 'super_admin' })
    .eq('id', id);
  if (roleError) throw new Error(`staffAccount failed: ${roleError.message}`);
  const client = createClient(url ?? '', publishableKey ?? '', { auth: { persistSession: false } });
  const { data: session, error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw signInError;
  return { id, email, password, token: session.session.access_token };
}

/** The PUUID of the user's linked Riot account (the stub generated it). */
export async function puuidOf(userId: string): Promise<string> {
  const { data, error } = await admin()
    .from('riot_accounts')
    .select('puuid')
    .eq('user_id', userId)
    .is('unlinked_at', null)
    .single();
  if (error) throw error;
  const row: unknown = data;
  return (row as { puuid: string }).puuid;
}

/** Deletes tournaments and everything hanging from them (audit entries stay: append-only). */
export async function deleteTournaments(slugPrefix: string): Promise<void> {
  if (!hasDatabase) return;
  const db = admin();
  const { data: tournaments } = await db
    .from('tournaments')
    .select('id')
    .like('slug', `${slugPrefix}%`);
  const T = (tournaments ?? []).map((t: { id: string }) => t.id);
  if (T.length === 0) return;
  const { data: entrants } = await db.from('entrants').select('id').in('tournament_id', T);
  const E = (entrants ?? []).map((e: { id: string }) => e.id);
  const { data: phases } = await db.from('phases').select('id').in('tournament_id', T);
  const P = (phases ?? []).map((p: { id: string }) => p.id);
  const { data: rulebooks } = await db.from('rulebooks').select('id').in('tournament_id', T);
  const R = (rulebooks ?? []).map((r: { id: string }) => r.id);
  const { data: matches } = await db.from('matches').select('id').in('tournament_id', T);
  const M = (matches ?? []).map((m: { id: string }) => m.id);
  // Notifications of these tournaments (the persistent staff account gets some too).
  const { data: notifications } = await db
    .from('notifications')
    .select('id')
    .in('data->>tournamentId', T);
  const N = (notifications ?? []).map((n: { id: string }) => n.id);
  const competition = [
    // m09 rows that point at the tournament (game lines go with the matches).
    () => db.from('mvp_awards').delete().in('tournament_id', T),
    () => db.from('champion_meta_stats').delete().in('tournament_id', T),
    () => db.from('user_achievements').delete().in('tournament_id', T),
    () => db.from('player_aggregate_stats').delete().in('scope_id', T),
    () => db.from('player_champion_stats').delete().in('scope_id', T),
    () => db.from('team_aggregate_stats').delete().in('scope_id', T),
    () => db.from('notification_deliveries').delete().in('notification_id', N),
    () => db.from('notifications').delete().in('id', N),
    () => db.from('outbox_events').delete().in('aggregate_id', M),
    () => db.from('standings').delete().in('tournament_id', T),
    // Games, check-ins, reports, disputes and reschedules go with their match.
    () =>
      db
        .from('matches')
        .update({ next_match_winner_id: null, next_match_loser_id: null })
        .in('tournament_id', T),
    () => db.from('matches').delete().in('tournament_id', T),
  ];
  for (const step of competition) {
    const { error } = await step();
    if (error) throw new Error(`E2E match cleanup failed: ${error.message}`);
  }
  const steps = [
    () =>
      db
        .from('outbox_events')
        .delete()
        .in('aggregate_id', [...T, ...E]),
    () => db.from('entrant_roster_members').delete().in('entrant_id', E),
    () => db.from('phase_entrants').delete().in('phase_id', P),
    () => db.from('entrants').delete().in('id', E),
    () => db.from('tournament_roster_rules').delete().in('tournament_id', T),
    () => db.from('groups').delete().in('phase_id', P),
    () => db.from('phases').delete().in('id', P),
    () => db.from('tournament_game_settings').delete().in('tournament_id', T),
    () => db.from('eligibility_rules').delete().in('tournament_id', T),
    () => db.from('schedule_windows').delete().in('tournament_id', T),
    () => db.from('schedule_blackouts').delete().in('tournament_id', T),
    () => db.from('tournament_prizes').delete().in('tournament_id', T),
    () => db.from('circuit_tournaments').delete().in('tournament_id', T),
    () => db.from('tournaments').update({ current_rulebook_version_id: null }).in('id', T),
    () => db.from('rulebook_versions').delete().in('rulebook_id', R),
    () => db.from('rulebooks').delete().in('id', R),
    () => db.from('tournaments').delete().in('id', T),
  ];
  for (const step of steps) {
    const { error } = await step();
    if (error) throw new Error(`E2E tournament cleanup failed: ${error.message}`);
  }
}

/** Deletes templates created by a run (by name prefix). */
export async function deleteTemplates(namePrefix: string): Promise<void> {
  if (!hasDatabase) return;
  const { error } = await admin()
    .from('tournament_templates')
    .delete()
    .like('name', `${namePrefix}%`);
  if (error) throw new Error(`E2E template cleanup failed: ${error.message}`);
}

/** Gives the account the staff platform role (access to /admin). */
export async function makeStaff(account: TestAccount): Promise<void> {
  const { error } = await admin()
    .from('users')
    .update({ platform_role: 'super_admin' })
    .eq('id', account.id);
  if (error) throw new Error(`makeStaff failed: ${error.message}`);
}

/** Deletes everything the accounts created (no cascades by design), then the users. */
export async function deleteAccounts(accounts: readonly TestAccount[]): Promise<void> {
  if (!hasDatabase || accounts.length === 0) return;
  const db = admin();
  const ids = accounts.map((a) => a.id);
  const { data: teams } = await db.from('teams').select('id').in('created_by', ids);
  const teamIds = (teams ?? []).map((t: { id: string }) => t.id);
  const { data: riot } = await db.from('riot_accounts').select('id').in('user_id', ids);
  const riotIds = (riot ?? []).map((r: { id: string }) => r.id);
  const steps = [
    db.from('notification_deliveries').delete().in('user_id', ids),
    db.from('notifications').delete().in('user_id', ids),
    db.from('user_notification_preferences').delete().in('user_id', ids),
    db.from('player_aggregate_stats').delete().in('user_id', ids),
    db.from('player_champion_stats').delete().in('user_id', ids),
    db.from('user_achievements').delete().in('user_id', ids),
    db.from('mvp_awards').delete().in('user_id', ids),
    db.from('follows').delete().in('follower_user_id', ids),
    db.from('team_aggregate_stats').delete().in('team_id', teamIds),
    db.from('team_captaincy_transfers').delete().in('team_id', teamIds),
    db.from('team_join_requests').delete().in('team_id', teamIds),
    db.from('team_join_requests').delete().in('user_id', ids),
    db.from('team_invitations').delete().in('team_id', teamIds),
    db.from('team_members').delete().in('team_id', teamIds),
    db.from('team_members').delete().in('user_id', ids),
    db.from('team_name_history').delete().in('team_id', teamIds),
    db.from('teams').delete().in('id', teamIds),
    db.from('free_agent_listings').delete().in('user_id', ids),
    db.from('riot_rank_snapshots').delete().in('riot_account_id', riotIds),
    db.from('riot_id_history').delete().in('riot_account_id', riotIds),
    db.from('riot_verification_attempts').delete().in('user_id', ids),
    db.from('riot_accounts').delete().in('user_id', ids),
    db.from('user_social_links').delete().in('user_id', ids),
    db.from('user_privacy_settings').delete().in('user_id', ids),
    db.from('user_private_data').delete().in('user_id', ids),
    db.from('users').delete().in('id', ids),
  ];
  for (const step of steps) {
    const { error } = await step;
    if (error) throw new Error(`E2E cleanup failed: ${error.message}`);
  }
  for (const id of ids) await db.auth.admin.deleteUser(id);
}
