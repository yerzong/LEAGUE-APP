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
