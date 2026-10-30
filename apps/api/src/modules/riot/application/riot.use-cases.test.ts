import { defaultPhase } from '@league/contracts';
import { RiotStubTournamentAdapter } from '@league/integrations';
import { describe, expect, it } from 'vitest';

import { ADMIN, ENTRANTS, setup, TOURNAMENT } from '../../matches/testing/competition-fixture.js';
import { GenerateFixturesUseCase } from '../../matches/application/matches.use-cases.js';
import { InMemoryRiotRepository } from '../testing/in-memory-riot-repository.js';
import type { RiotDeps } from './deps.js';
import {
  ConnectRiotUseCase,
  GenerateCodeUseCase,
  GetRiotStatusUseCase,
  ProcessRiotCallbackUseCase,
} from './riot.use-cases.js';

/** A round-robin (bo1) tournament in Riot-automatic mode, fixtures generated. */
async function riotSetup() {
  const ctx = setup([defaultPhase('round_robin', 'Liga')]);
  const tournament = ctx.tournamentRepo.tournaments[0];
  if (!tournament) throw new Error('fixture');
  // Riot-automatic mode, 1v1 so one game decides a bo1 with a single-PUUID roster.
  tournament.config = {
    ...tournament.config,
    supervision: { level: 'automatic' },
    game: { ...tournament.config.game, teamSize: 1 },
  };
  await new GenerateFixturesUseCase(ctx.deps).execute(ADMIN, TOURNAMENT);

  const repo = new InMemoryRiotRepository(TOURNAMENT);
  for (const [i, entrant] of ENTRANTS.entries())
    repo.rosters.set(entrant, [
      { userId: `u${String(i)}`, puuid: `puuid-${String(i)}`, riotAccountId: `ra${String(i)}` },
    ]);
  const stub = new RiotStubTournamentAdapter();
  const deps: RiotDeps = {
    repo,
    tournamentApi: stub,
    matchData: stub,
    matches: ctx.deps,
    tournaments: ctx.deps.tournaments,
    organization: { id: () => Promise.resolve('org') },
    clock: { now: () => new Date('2026-10-30T18:00:00.000Z') },
    settings: {
      provider: 'stub',
      live: false,
      callbackUrl: 'https://api/integrations/riot/callbacks',
      region: 'la1',
    },
  };
  const match = ctx.matches.matches.find((m) => m.entrantA && m.entrantB);
  if (!match) throw new Error('no playable match');
  return { ctx, repo, stub, deps, match };
}

describe('Riot Tournament flow (RIOT_PROVIDER=stub)', () => {
  it('runs generate → callback → complete → standings end to end', async () => {
    const { ctx, repo, stub, deps, match } = await riotSetup();

    await new ConnectRiotUseCase(deps).execute(ADMIN, TOURNAMENT);
    expect(repo.setup?.riotTournamentId).toBeGreaterThan(0);

    const generate = new GenerateCodeUseCase(deps);
    const process = new ProcessRiotCallbackUseCase(deps);

    const first = await generate.execute(match.id, {});
    // The code admits the frozen roster PUUIDs of both sides.
    expect(stub.allowedOf(first.code).length).toBe(2);
    expect([...stub.allowedOf(first.code)]).toContain('puuid-0');

    // Blue (= entrant A) wins game 1; the bo3 is still open.
    expect((await process.execute(stub.simulateResult(first.code, 'blue'))).status).toBe(
      'processed',
    );
    expect(ctx.matches.matches.find((m) => m.id === match.id)?.status).not.toBe('completed');

    // Game 2: blue wins again → the series is decided 2-0.
    const second = await generate.execute(match.id, {});
    expect((await process.execute(stub.simulateResult(second.code, 'blue'))).status).toBe(
      'processed',
    );

    const completed = ctx.matches.matches.find((m) => m.id === match.id);
    expect(completed?.status).toBe('completed');
    expect(completed?.winnerId).toBe(match.entrantA);
    // The standings now count the played match.
    expect(ctx.matches.standings_.some((s) => s.played > 0)).toBe(true);
    expect(repo.alerts).toHaveLength(0);
  });

  it('is idempotent: the same callback does not re-process', async () => {
    const { deps, stub, match } = await riotSetup();
    await new ConnectRiotUseCase(deps).execute(ADMIN, TOURNAMENT);
    const { code } = await new GenerateCodeUseCase(deps).execute(match.id, {});
    const callback = stub.simulateResult(code, 'blue');
    expect((await new ProcessRiotCallbackUseCase(deps).execute(callback)).status).toBe('processed');
    expect((await new ProcessRiotCallbackUseCase(deps).execute(callback)).status).toBe('duplicate');
  });

  it('raises an integrity alert when a participant is outside the roster', async () => {
    const { deps, repo, stub, match } = await riotSetup();
    await new ConnectRiotUseCase(deps).execute(ADMIN, TOURNAMENT);
    const { code } = await new GenerateCodeUseCase(deps).execute(match.id, {});
    // A ringer plays the red side instead of the frozen roster PUUID.
    const callback = stub.simulateResult(code, 'blue', ['puuid-0', 'puuid-ringer']);
    await new ProcessRiotCallbackUseCase(deps).execute(callback);
    expect(repo.alerts).toHaveLength(1);
    expect(repo.alerts[0]?.type).toBe('roster_mismatch');
    expect((repo.alerts[0]?.evidence as { unexpected: string[] }).unexpected).toContain(
      'puuid-ringer',
    );
  });

  it('refuses to generate a code when the tournament is not automatic', async () => {
    const { ctx, deps, match } = await riotSetup();
    const tournament = ctx.tournamentRepo.tournaments[0];
    if (tournament)
      tournament.config = { ...tournament.config, supervision: { level: 'dual_report' } };
    await new ConnectRiotUseCase(deps).execute(ADMIN, TOURNAMENT);
    await expect(new GenerateCodeUseCase(deps).execute(match.id, {})).rejects.toMatchObject({
      code: 'not_automatic',
    });
  });

  it('reports the integration status for the admin console', async () => {
    const { deps, stub, match } = await riotSetup();
    await new ConnectRiotUseCase(deps).execute(ADMIN, TOURNAMENT);
    const { code } = await new GenerateCodeUseCase(deps).execute(match.id, {});
    await new ProcessRiotCallbackUseCase(deps).execute(stub.simulateResult(code, 'blue'));
    const status = await new GetRiotStatusUseCase(deps).execute(TOURNAMENT);
    expect(status).toMatchObject({
      connected: true,
      provider: 'stub',
      codesGenerated: 1,
      codesUsed: 1,
    });
    expect(status.recentCallbacks[0]?.status).toBe('processed');
  });
});
