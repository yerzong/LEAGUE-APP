import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

// Runs against production builds: `pnpm build` must have run first (turbo does it).
export default defineConfig({
  testDir: './e2e',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @league/api start',
      url: 'http://localhost:4000/health',
      reuseExistingServer: !isCI,
      // GET /health never contacts Supabase; placeholders satisfy env validation.
      env: {
        SUPABASE_URL: process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321',
        SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_e2e',
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
