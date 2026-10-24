import type { Database } from '@league/db';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type AdminClient = SupabaseClient<Database>;

export const SUPABASE_ADMIN = Symbol('SupabaseAdmin');

/** Service-role client: bypasses RLS, so only use cases (after their permission checks) use it. */
export function createAdminClient(url: string, secretKey: string): AdminClient {
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
