import {
  DEFAULT_TOURNAMENT_CONFIG,
  type TeamRole,
  type TournamentConfig,
  type TournamentStatus,
} from '@league/contracts';
import { createFormatRegistry } from '@league/core';
import { describe, expect, it } from 'vitest';

import { ApplicationError } from '../../../shared/application-error.js';
import { FakeImageStorage } from '../../identity/testing/fake-image-storage.js';
import type { TournamentsDeps } from '../../tournaments/application/deps.js';
import { TournamentQueries } from '../../tournaments/application/tournaments.use-cases.js';
import {
  InMemoryTemplateRepository,
  InMemoryTournamentRepository,
} from '../../tournaments/testing/in-memory-tournament-repository.js';
import { InMemoryRegistrationRepository } from '../testing/in-memory-registration-repository.js';
import type { RegistrationsDeps } from './deps.js';
import type { PlayerFacts } from './ports.js';
import {
  CheckRegistrationUseCase,
  DecideRegistrationUseCase,
  ExploreTournamentsUseCase,
  GetRegistrationContextUseCase,
  ListRegistrationsUseCase,
  RegisterUseCase,
  RegistrationCountsUseCase,
  SeedRegistrationsUseCase,
  WithdrawRegistrationUseCase,
} from './registrations.use-cases.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ADMIN = id(900);
const ANA = id(1);
const BETO = id(2);
const CARO = id(3);
const DANI = id(4);
const EVA = id(5);
const AURORA = id(101);
const BOREAL = id(102);
const CENIT = id(103);
const RULEBOOK = id(301);

const config: TournamentConfig = {
  ...DEFAULT_TOURNAMENT_CONFIG,
  basics: { ...DEFAULT_TOURNAMENT_CONFIG.basics, name: 'Relámpago Dúos' },
  capacity: { capacity: 2, waitlistEnabled: true },
  game: { ...DEFAULT_TOURNAMENT_CONFIG.game, teamSize: 2 },
  roster: {
    ...DEFAULT_TOURNAMENT_CONFIG.roster,
    starters: 2,
    maxSubstitutes: 1,
    coachAllowed: false,
  },
  eligibility: {
    exclusivityScope: 'tournament',
    circuitId: null,
    rules: [
      { type: 'riot_account_verified' },
      { type: 'rank_max', params: { rank: { tier: 'diamond', division: 1 } } },
      { type: 'age_min', params: { years: 16 } },
    ],
  },
};

const fact = (userId: string, overrides: Partial<PlayerFacts> = {}): PlayerFacts => ({
  userId,
  username: `user${userId.slice(-1)}`,
  displayName: null,
  avatarUrl: null,
  riot: {
    accountId: `riot-${userId}`,
    riotId: `P${userId.slice(-1)}#LAN`,
    region: 'la1',
    summonerLevel: 100,
    rank: { tier: 'gold', division: 2 },
    rankHistory: [],
    rankedGames: 50,
  },
  birthDate: '2000-01-01',
  countryCode: 'MX',
  gender: null,
  legalNameProvided: true,
  institution: null,
  ...overrides,
});

const riotOf = (userId: string) => {
  const { riot } = fact(userId);
  if (!riot) throw new Error('fixture without Riot');
  return riot;
};

const rosterOf = (...users: string[]) =>
  users.map((userId) => ({ userId, role: 'starter' as const, gameRole: null }));

function setup(
  status: TournamentStatus = 'registration_open',
  overrides: Partial<TournamentConfig> = {},
) {
  const now = new Date('2026-10-26T12:00:00.000Z');
  const tournamentRepo = new InMemoryTournamentRepository(() => now);
  const tournamentsDeps: TournamentsDeps = {
    tournaments: tournamentRepo,
    templates: new InMemoryTemplateRepository(),
    staff: {
      isStaff: (u) => Promise.resolve(u === ADMIN),
      summaries: () => Promise.resolve(new Map()),
    },
    organization: { id: () => Promise.resolve('org') },
    storage: new FakeImageStorage(),
    clock: { now: () => now },
    formats: createFormatRegistry(),
    newId: () => 'file',
  };
  const tournamentId = id(201);
  tournamentRepo.tournaments.push({
    id: tournamentId,
    organizationId: 'org',
    slug: 'relampago-duos',
    status,
    config: { ...config, ...overrides },
    templateId: null,
    coverPath: null,
    currentRulebookVersionId: RULEBOOK,
    publishedAt: now,
    createdAt: now,
  });
  tournamentRepo.rulebooks.set(tournamentId, {
    title: 'Reglamento',
    versions: [
      { id: RULEBOOK, version: 1, content: '# Reglas', changeSummary: null, publishedAt: now },
    ],
  });

  const members: Record<string, { userId: string; teamRole: TeamRole; gameRole: null }[]> = {
    [AURORA]: [
      { userId: ANA, teamRole: 'captain', gameRole: null },
      { userId: BETO, teamRole: 'player', gameRole: null },
      { userId: EVA, teamRole: 'substitute', gameRole: null },
    ],
    [BOREAL]: [
      { userId: CARO, teamRole: 'captain', gameRole: null },
      { userId: BETO, teamRole: 'player', gameRole: null },
    ],
    [CENIT]: [
      { userId: DANI, teamRole: 'captain', gameRole: null },
      { userId: EVA, teamRole: 'player', gameRole: null },
    ],
  };
  const teamView = (teamId: string) => ({
    id: teamId,
    slug: { [AURORA]: 'aurora', [BOREAL]: 'boreal', [CENIT]: 'cenit' }[teamId] ?? 'x',
    name: { [AURORA]: 'Aurora', [BOREAL]: 'Boreal', [CENIT]: 'Cenit' }[teamId] ?? 'X',
    tag: 'TAG',
    logoPath: null,
    status: 'active',
  });

  const facts = new Map<string, PlayerFacts>([ANA, BETO, CARO, DANI, EVA].map((u) => [u, fact(u)]));
  const registrations = new InMemoryRegistrationRepository(() => now, tournamentRepo);
  let randomCalls = 0;
  const deps: RegistrationsDeps = {
    registrations,
    tournaments: new TournamentQueries(tournamentsDeps),
    teams: {
      findById: (teamId) => Promise.resolve(members[teamId] ? teamView(teamId) : null),
      activeMembers: (teamId) => Promise.resolve(members[teamId] ?? []),
      activeTeamsOf: (userId) =>
        Promise.resolve(
          Object.entries(members).flatMap(([teamId, list]) =>
            list
              .filter((m) => m.userId === userId)
              .map((m) => ({ team: teamView(teamId), role: m.teamRole })),
          ),
        ),
      logoUrl: (path) => (path ? `https://storage.test/${path}` : null),
    },
    players: {
      factsOf: (ids) =>
        Promise.resolve(
          new Map(
            ids.flatMap((u) => {
              const f = facts.get(u);
              return f ? [[u, f] as const] : [];
            }),
          ),
        ),
    },
    clock: { now: () => now },
    random: () => {
      randomCalls += 1;
      return 0;
    },
  };
  return {
    deps,
    facts,
    registrations,
    tournamentRepo,
    tournamentId,
    randomCalls: () => randomCalls,
  };
}

async function rejects(promise: Promise<unknown>, code: string) {
  const error: unknown = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(Error);
  const actual =
    error instanceof ApplicationError
      ? error.code
      : ((error as { details?: { reason?: string } }).details?.reason ??
        (error as { code?: string }).code);
  expect(actual).toBe(code);
  return error as ApplicationError;
}

const register = (
  deps: RegistrationsDeps,
  actor: string,
  tournamentId: string,
  teamId: string,
  ...users: string[]
) =>
  new RegisterUseCase(deps).execute(actor, tournamentId, {
    teamId,
    roster: rosterOf(...users),
    rulebookVersionId: RULEBOOK,
    acceptRules: true,
  });

describe('CheckRegistrationUseCase', () => {
  it('reports eligibility per rule and player, with the reason', async () => {
    const { deps, facts, tournamentId } = setup();
    facts.set(BETO, fact(BETO, { riot: null }));
    const check = await new CheckRegistrationUseCase(deps).execute(ANA, tournamentId, {
      teamId: AURORA,
      roster: rosterOf(ANA, BETO),
    });
    expect(check).toEqual({
      ok: false,
      blockers: [],
      rosterViolations: [],
      failures: [
        {
          rule: 'riot_account_verified',
          userId: BETO,
          reason: 'riot_account_not_verified',
          details: {},
        },
      ],
    });
  });

  it('hides personal details of teammates from the captain', async () => {
    const { deps, facts, tournamentId } = setup();
    facts.set(BETO, fact(BETO, { birthDate: '2012-03-01' }));
    const check = await new CheckRegistrationUseCase(deps).execute(ANA, tournamentId, {
      teamId: AURORA,
      roster: rosterOf(ANA, BETO),
    });
    expect(check.failures).toEqual([
      { rule: 'age_min', userId: BETO, reason: 'underage', details: {} },
    ]);
  });

  it('lists what blocks the registration before eligibility', async () => {
    const closed = setup('published');
    expect(
      (
        await new CheckRegistrationUseCase(closed.deps).execute(ANA, closed.tournamentId, {
          teamId: AURORA,
          roster: rosterOf(ANA, BETO),
        })
      ).blockers,
    ).toEqual(['registration_closed']);

    const { deps, tournamentId } = setup();
    const check = new CheckRegistrationUseCase(deps);
    expect(
      (await check.execute(BETO, tournamentId, { teamId: AURORA, roster: rosterOf(ANA, BETO) }))
        .blockers,
    ).toEqual(['not_team_manager']);
    expect(
      (await check.execute(ANA, tournamentId, { teamId: null, roster: rosterOf(ANA) })).blockers,
    ).toEqual(['team_required']);
  });

  it('validates the roster against the roster rules of the tournament', async () => {
    const { deps, tournamentId } = setup();
    const check = await new CheckRegistrationUseCase(deps).execute(ANA, tournamentId, {
      teamId: AURORA,
      roster: [...rosterOf(ANA), { userId: DANI, role: 'substitute', gameRole: null }],
    });
    expect(check.rosterViolations.map((v) => v.reason)).toEqual([
      'starters_count',
      'not_a_team_member',
    ]);
    expect(check.ok).toBe(false);
  });
});

describe('RegisterUseCase', () => {
  it('registers a team with its roster, the accepted rulebook and its exclusivity key', async () => {
    const { deps, registrations, tournamentId } = setup();
    const created = await register(deps, ANA, tournamentId, AURORA, ANA, BETO);
    expect(created).toMatchObject({
      status: 'pending',
      displayName: 'Aurora',
      paymentStatus: 'not_required',
      canWithdraw: true,
    });
    const stored = registrations.entrants[0];
    expect(stored?.rulebookVersionId).toBe(RULEBOOK);
    expect(stored?.roster.map((r) => r.exclusivityKey)).toEqual([
      `tournament:${tournamentId}`,
      `tournament:${tournamentId}`,
    ]);
    expect(registrations.events).toEqual(['registration.submitted']);
  });

  it('refuses ineligible rosters and an outdated rulebook', async () => {
    const { deps, facts, tournamentId } = setup();
    facts.set(BETO, fact(BETO, { riot: { ...riotOf(BETO), rank: { tier: 'master' } } }));
    const error = await rejects(
      register(deps, ANA, tournamentId, AURORA, ANA, BETO),
      'registration_ineligible',
    );
    expect(error.details).toMatchObject({
      failures: [{ rule: 'rank_max', userId: BETO, reason: 'rank_above_max' }],
    });
    await rejects(
      new RegisterUseCase(deps).execute(ANA, tournamentId, {
        teamId: AURORA,
        roster: rosterOf(ANA, EVA),
        rulebookVersionId: id(999),
        acceptRules: true,
      }),
      'registration_blocked',
    );
  });

  it('blocks a player already in another roster of the scope (anti-chapulineo)', async () => {
    const { deps, tournamentId } = setup();
    await register(deps, ANA, tournamentId, AURORA, ANA, BETO);
    const error = await rejects(
      register(deps, CARO, tournamentId, BOREAL, CARO, BETO),
      'registration_ineligible',
    );
    expect(error.details).toMatchObject({
      failures: [{ rule: 'exclusivity', userId: BETO, reason: 'exclusivity_conflict' }],
    });
  });

  it('waitlists beyond capacity and refuses a second registration of the team', async () => {
    const { deps, tournamentId } = setup('registration_open', {
      capacity: { capacity: 1, waitlistEnabled: true },
    });
    await register(deps, ANA, tournamentId, AURORA, ANA, BETO);
    const waiting = await register(deps, DANI, tournamentId, CENIT, DANI, EVA);
    expect(waiting).toMatchObject({ status: 'waitlisted', waitlistPosition: 1 });
    await rejects(register(deps, ANA, tournamentId, AURORA, ANA, BETO), 'registration_blocked');
  });

  it('marks the payment as pending when the tournament has a fee', async () => {
    const { deps, tournamentId } = setup('registration_open', {
      participants: { ...config.participants, fee: { amount: 10000, currency: 'MXN' } },
    });
    expect((await register(deps, ANA, tournamentId, AURORA, ANA, BETO)).paymentStatus).toBe(
      'pending',
    );
  });
});

describe('DecideRegistrationUseCase', () => {
  it('lets only staff approve, and audits it', async () => {
    const { deps, registrations, tournamentId } = setup();
    const created = await register(deps, ANA, tournamentId, AURORA, ANA, BETO);
    const decide = new DecideRegistrationUseCase(deps);
    await rejects(
      decide.execute(ANA, created.id, {
        decision: 'approve',
        reason: null,
        overrideEligibility: false,
      }),
      'staff_only',
    );
    const approved = await decide.execute(ADMIN, created.id, {
      decision: 'approve',
      reason: null,
      overrideEligibility: false,
    });
    expect(approved.status).toBe('approved');
    expect(registrations.audit).toEqual([{ action: 'registration.approved', reason: null }]);
    expect(registrations.events).toContain('registration.approved');
  });

  it('re-evaluates eligibility and needs a reason to approve as an exception', async () => {
    const { deps, facts, registrations, tournamentId } = setup();
    const created = await register(deps, ANA, tournamentId, AURORA, ANA, BETO);
    facts.set(BETO, fact(BETO, { riot: null }));
    const decide = new DecideRegistrationUseCase(deps);
    await rejects(
      decide.execute(ADMIN, created.id, {
        decision: 'approve',
        reason: null,
        overrideEligibility: false,
      }),
      'registration_ineligible',
    );
    await rejects(
      decide.execute(ADMIN, created.id, {
        decision: 'approve',
        reason: null,
        overrideEligibility: true,
      }),
      'reason_required',
    );
    await decide.execute(ADMIN, created.id, {
      decision: 'approve',
      reason: 'Cuenta verificada por Discord',
      overrideEligibility: true,
    });
    expect(registrations.audit.at(-1)).toEqual({
      action: 'registration.approved_with_exception',
      reason: 'Cuenta verificada por Discord',
    });
  });

  it('rejects with a reason, releasing the slot for the waitlist', async () => {
    const { deps, registrations, tournamentId } = setup('registration_open', {
      capacity: { capacity: 1, waitlistEnabled: true },
    });
    const first = await register(deps, ANA, tournamentId, AURORA, ANA, BETO);
    await register(deps, DANI, tournamentId, CENIT, DANI, EVA);
    const decide = new DecideRegistrationUseCase(deps);
    await rejects(
      decide.execute(ADMIN, first.id, {
        decision: 'reject',
        reason: 'corto',
        overrideEligibility: false,
      }),
      'reason_required',
    );
    await decide.execute(ADMIN, first.id, {
      decision: 'reject',
      reason: 'Roster no disponible el día del torneo',
      overrideEligibility: false,
    });
    expect(registrations.entrants.map((e) => e.status)).toEqual(['rejected', 'pending']);
    expect(registrations.events).toContain('registration.promoted');
  });

  it('refuses to approve beyond capacity', async () => {
    const { deps, tournamentId } = setup('registration_open', {
      capacity: { capacity: 1, waitlistEnabled: true },
    });
    await register(deps, ANA, tournamentId, AURORA, ANA, BETO);
    const waiting = await register(deps, DANI, tournamentId, CENIT, DANI, EVA);
    const decide = new DecideRegistrationUseCase(deps);
    const [first] = await new ListRegistrationsUseCase(deps).execute(ADMIN, tournamentId);
    await decide.execute(ADMIN, first?.id ?? '', {
      decision: 'approve',
      reason: null,
      overrideEligibility: false,
    });
    await rejects(
      decide.execute(ADMIN, waiting.id, {
        decision: 'approve',
        reason: null,
        overrideEligibility: false,
      }),
      'tournament_full',
    );
  });
});

describe('WithdrawRegistrationUseCase', () => {
  it('lets the captain withdraw, nobody else', async () => {
    const { deps, tournamentId } = setup();
    const created = await register(deps, ANA, tournamentId, AURORA, ANA, BETO);
    const withdraw = new WithdrawRegistrationUseCase(deps);
    await rejects(withdraw.execute(CARO, created.id), 'not_registration_owner');
    expect((await withdraw.execute(ANA, created.id)).status).toBe('withdrawn');
  });
});

describe('SeedRegistrationsUseCase', () => {
  async function closedWithTwo() {
    const ctx = setup();
    const a = await register(ctx.deps, ANA, ctx.tournamentId, AURORA, ANA, BETO);
    const d = await register(ctx.deps, DANI, ctx.tournamentId, CENIT, DANI, EVA);
    const decide = new DecideRegistrationUseCase(ctx.deps);
    for (const r of [a, d])
      await decide.execute(ADMIN, r.id, {
        decision: 'approve',
        reason: null,
        overrideEligibility: false,
      });
    ctx.tournamentRepo.setStatus(ctx.tournamentId, 'registration_closed');
    return { ...ctx, aurora: a.id, cenit: d.id };
  }

  it('seeds by average rank of the roster', async () => {
    const ctx = await closedWithTwo();
    ctx.facts.set(EVA, fact(EVA, { riot: { ...riotOf(EVA), rank: { tier: 'master' } } }));
    const list = await new SeedRegistrationsUseCase(ctx.deps).execute(ADMIN, ctx.tournamentId, {
      method: 'rank',
      seeds: [],
    });
    expect(list.map((r) => [r.displayName, r.seed])).toEqual([
      ['Cenit', 1],
      ['Aurora', 2],
    ]);
    expect(ctx.registrations.audit.at(-1)).toEqual({ action: 'tournament.seeded', reason: null });
  });

  it('accepts a manual order and refuses seeding while registration is open', async () => {
    const ctx = await closedWithTwo();
    const seed = new SeedRegistrationsUseCase(ctx.deps);
    await rejects(
      seed.execute(ADMIN, ctx.tournamentId, {
        method: 'manual',
        seeds: [{ entrantId: ctx.aurora, seed: 1 }],
      }),
      'invalid_seeding',
    );
    const manual = await seed.execute(ADMIN, ctx.tournamentId, {
      method: 'manual',
      seeds: [
        { entrantId: ctx.aurora, seed: 2 },
        { entrantId: ctx.cenit, seed: 1 },
      ],
    });
    expect(manual.find((r) => r.id === ctx.aurora)?.seed).toBe(2);

    const open = setup();
    await rejects(
      new SeedRegistrationsUseCase(open.deps).execute(ADMIN, open.tournamentId, {
        method: 'random',
        seeds: [],
      }),
      'seeding_closed',
    );
  });
});

describe('staff lists and the portal', () => {
  it('lists registrations with their roster and live eligibility, and counts them', async () => {
    const { deps, facts, tournamentId } = setup();
    await register(deps, ANA, tournamentId, AURORA, ANA, BETO);
    facts.set(BETO, fact(BETO, { birthDate: '2012-03-01' }));
    const [registration] = await new ListRegistrationsUseCase(deps).execute(ADMIN, tournamentId);
    expect(registration?.roster.map((m) => m.riotId)).toEqual(['P1#LAN', 'P2#LAN']);
    expect(registration?.eligibility).toEqual({
      eligible: false,
      failures: [
        { rule: 'age_min', userId: BETO, reason: 'underage', details: { age: 14, min: 16 } },
      ],
    });
    expect(await new RegistrationCountsUseCase(deps).execute(ADMIN, [tournamentId])).toEqual({
      [tournamentId]: { pending: 1, approved: 0, waitlisted: 0 },
    });
    await rejects(new ListRegistrationsUseCase(deps).execute(ANA, tournamentId), 'staff_only');
  });

  it('explores open tournaments with an eligibility indicator per managed team', async () => {
    const { deps, facts, tournamentId } = setup();
    facts.set(EVA, fact(EVA, { riot: null }));
    const [item] = await new ExploreTournamentsUseCase(deps).execute(ANA);
    expect(item?.id).toBe(tournamentId);
    expect(item?.options).toEqual([
      {
        teamId: AURORA,
        label: 'Aurora',
        eligible: false,
        failures: [
          {
            rule: 'riot_account_verified',
            userId: EVA,
            reason: 'riot_account_not_verified',
            details: {},
          },
        ],
        blockers: [],
        registration: null,
      },
    ]);

    const [forPlayer] = await new ExploreTournamentsUseCase(deps).execute(BETO);
    expect(forPlayer?.options).toEqual([
      {
        teamId: null,
        label: '',
        eligible: true,
        failures: [],
        blockers: ['not_team_manager'],
        registration: null,
      },
    ]);
  });

  it('gives the registration context: managed teams, rulebook and my registrations', async () => {
    const { deps, tournamentId } = setup();
    await register(deps, ANA, tournamentId, AURORA, ANA, BETO);
    const context = await new GetRegistrationContextUseCase(deps).execute(ANA, 'relampago-duos');
    expect(context.tournament.rulebook?.id).toBe(RULEBOOK);
    expect(context.teams.map((t) => [t.name, t.members.length])).toEqual([['Aurora', 3]]);
    expect(context.myRegistrations.map((r) => r.status)).toEqual(['pending']);
    await rejects(
      new GetRegistrationContextUseCase(deps).execute(ANA, 'no-existe'),
      'tournament_not_found',
    );
  });
});
