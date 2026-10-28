import { existsSync } from 'node:fs';

import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

// Local runs read the API's .env (penta-dev): the E2E flows that need a
// database create their own users with the secret key and delete them after.
// CI sets the same variables from a local Supabase (supabase start).
if (!isCI && existsSync('../api/.env')) process.loadEnvFile('../api/.env');

// Runs against production builds: `pnpm build` must have run first (turbo does it).
export default defineConfig({
  testDir: './e2e',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // Flows share the API's in-memory Riot stub and real users: one worker.
  workers: 1,
  reporter: isCI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @league/api start',
      url: 'http://localhost:4000/health',
      reuseExistingServer: !isCI,
      // Placeholders keep GET /health working without a database; RIOT_PROVIDER
      // is always the stub, E2E never calls Riot.
      env: {
        SUPABASE_URL: process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321',
        SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_e2e',
        SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY ?? 'sb_secret_e2e',
        RIOT_PROVIDER: 'stub',
        // The bell flow waits for the worker: a short interval keeps it quick.
        NOTIFICATIONS_POLL_SECONDS: '1',
      },
    },
    {
      command: 'pnpm start',
      url: 'http://localhost:3000',
      reuseExistingServer: !isCI,
      env: { API_URL: 'http://localhost:4000' },
    },
  ],
});
