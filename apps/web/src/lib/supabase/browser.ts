'use client';

import type { Database } from '@league/db';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { publicEnv } from '@/config/public-env';

let client: SupabaseClient<Database> | null = null;

/** Browser client (publishable key, RLS applies). Used for Realtime only. */
export function browserSupabase(): SupabaseClient<Database> {
  client ??= createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  return client;
}
