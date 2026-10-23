import type { Database } from '@league/db';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { AccessTokenVerifier } from '../application/ports.js';
import type { AuthenticatedUser } from '../domain/authenticated-user.js';

/**
 * Verifies Supabase access tokens. With asymmetric signing keys (penta-dev) the
 * signature is checked locally against the project's JWKS; with a shared secret
 * (local CLI) it falls back to asking Supabase Auth.
 */
export class SupabaseAccessTokenVerifier implements AccessTokenVerifier {
  private readonly client: SupabaseClient<Database>;

  constructor(supabaseUrl: string, publishableKey: string) {
    this.client = createClient<Database>(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }

  async verify(accessToken: string): Promise<AuthenticatedUser | null> {
    const { data, error } = await this.client.auth.getClaims(accessToken);
    if (error || !data) return null;
    const { sub, role, email } = data.claims;
    if (role !== 'authenticated' || !sub) return null;
    return { id: sub, email: typeof email === 'string' && email !== '' ? email : null };
  }
}
