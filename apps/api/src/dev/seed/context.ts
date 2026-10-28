// The seed runs the API's own modules in-process (Nest application context):
// every write goes through the same use cases, Zod contracts and svc_* functions
// as a request would. Only two providers change: the Riot stub knows the demo
// accounts (with their ranks) and the clock can be moved back to play the past
// rounds of the league.
import 'reflect-metadata';

import { createClient } from '@supabase/supabase-js';
import { StubRiotAccountAdapter, type RiotRankEntry } from '@league/integrations';
import type { Type } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';

import { AppModule } from '../../app.module.js';
import { loadEnv } from '../../config/env.js';
import { RIOT_ACCOUNT_PORT } from '../../modules/riot-accounts/application/ports.js';
import { CLOCK, type Clock } from '../../shared/clock.js';
import { SUPABASE_ADMIN, type AdminClient } from '../../shared/database/supabase-admin.js';
import { CURRENT_ORGANIZATION, type CurrentOrganization } from '../../shared/organization.js';
import { DEMO_PLAYERS } from './demo-data.js';

/** System time, or a fixed instant while the seed replays the past. */
export class SeedClock implements Clock {
  private at: Date | null = null;

  now(): Date {
    return this.at ?? new Date();
  }

  set(at: Date | null): void {
    this.at = at;
  }
}

const demoRiotAccounts = () =>
  DEMO_PLAYERS.map((p) => ({
    puuid: `demo-${p.key}`,
    gameName: p.riot.gameName,
    tagLine: p.riot.tagLine,
    profileIconId: 0,
    summonerLevel: p.riot.level,
    ranks: [
      {
        queue: 'solo',
        tier: p.riot.rank.tier,
        division: p.riot.rank.division as RiotRankEntry['division'],
        lp: p.riot.rank.lp,
        wins: 40,
        losses: 35,
      } satisfies RiotRankEntry,
    ],
  }));

export interface SeedContext {
  use<T>(type: Type<T>): T;
  db: AdminClient;
  /** Auth admin and sign-in: a client separate from the shared one. */
  auth: AdminClient['auth'];
  clock: SeedClock;
  organizationId: string;
  close(): Promise<void>;
}

export async function openSeedContext(source: NodeJS.ProcessEnv): Promise<SeedContext> {
  // The stub never calls Riot, and the check-in sweeper stays off in this process.
  const env = loadEnv({ ...source, RIOT_PROVIDER: 'stub', CHECKIN_SWEEP_SECONDS: '0' });
  const clock = new SeedClock();
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule.register(env)],
  })
    .overrideProvider(RIOT_ACCOUNT_PORT)
    .useValue(new StubRiotAccountAdapter({ accounts: demoRiotAccounts(), generateAccounts: true }))
    .overrideProvider(CLOCK)
    .useValue(clock)
    .compile();
  moduleRef.useLogger(['error']);
  const db = moduleRef.get<AdminClient>(SUPABASE_ADMIN);
  const organizationId = await moduleRef.get<CurrentOrganization>(CURRENT_ORGANIZATION).id();
  const auth = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth;
  return {
    use: (type) => moduleRef.get(type),
    db,
    auth,
    clock,
    organizationId,
    close: () => moduleRef.close(),
  };
}

/** True when an API answers on API_URL: its check-in sweeper would race the seed. */
export async function apiIsRunning(url: string): Promise<boolean> {
  try {
    const response = await fetch(new URL('/health', url), { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

/** Every auth user (paged), to find demo accounts by email. */
export async function listAuthUsers(auth: AdminClient['auth']) {
  const users: { id: string; email?: string | undefined }[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}
