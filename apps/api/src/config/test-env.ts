import { type Env, loadEnv } from './env.js';

/** Valid environment for tests; Supabase is never contacted with these values. */
export function testEnv(overrides: NodeJS.ProcessEnv = {}): Env {
  return loadEnv({
    SUPABASE_URL: 'http://127.0.0.1:54321',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    SUPABASE_SECRET_KEY: 'sb_secret_test',
    CHECKIN_SWEEP_SECONDS: '0',
    NOTIFICATIONS_POLL_SECONDS: '0',
    STATS_POLL_SECONDS: '0',
    DISCORD_POLL_SECONDS: '0',
    CHAMPIONS_PROVIDER: 'static',
    ...overrides,
  });
}
