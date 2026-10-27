// Registration use cases. Eligibility, exclusivity, roster rules, the entrant
// lifecycle and seeding all come from packages/core; this file loads the facts,
// checks permissions and hands the decision to the repository (which audits
// and emits the domain events in the same transaction).

import {
  ReasonSchema,
  type DecideRegistrationRequest,
  type EligibilityFailure,
  type ExploreTournament,
  type MyRegistration,
  type PublicParticipant,
  type RegisterRequest,
  type Registration,
  type RegistrationCheck,
  type RegistrationCheckRequest,
  type RegistrationContext,
  type RegistrationCounts,
  type RegistrationOption,
  type SeedingRequest,
} from '@league/contracts';
import {
  averageRankValue,
  effectiveEligibilityRules,
  entrantLifecycle,
  evaluateEligibility,
  rosterExclusivityKey,
  seedEntrants,
  teamCan,
  validateRoster,
  type EligibilityResult,
  type EligibilityRule,
  type PlayerProfile,
  type Rank,
  type RosterMembership,
  type RosterViolation,
} from '@league/core';

import {
  ApplicationError,
  conflict,
  forbidden,
  notFound,
} from '../../../shared/application-error.js';
import type { TournamentRecord } from '../../tournaments/domain/tournament.js';
import {
  ACTIVE_STATUSES,
  OPEN_FOR_DECISIONS,
  PERSONAL_DETAILS,
  type EntrantRecord,
  type RosterRecord,
} from '../domain/registration.js';
import type { RegistrationsDeps } from './deps.js';
import type { PlayerFacts, TeamView } from './ports.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function requireStaff(deps: RegistrationsDeps, userId: string) {
  if (!(await deps.tournaments.isStaff(userId))) throw forbidden('staff_only');
}

async function loadTournament(deps: RegistrationsDeps, tournamentId: string) {
  const tournament = await deps.tournaments.findById(tournamentId);
  if (!tournament) throw notFound('tournament_not_found');
  return tournament;
}

async function loadEntrant(deps: RegistrationsDeps, entrantId: string) {
  const entrant = await deps.registrations.find(entrantId);
  if (!entrant) throw notFound('registration_not_found');
  return entrant;
}

const requireReason = (reason: string | null) => {
  if (!ReasonSchema.safeParse(reason ?? '').success)
    throw new ApplicationError('invalid', 'reason_required');
};

const isOpenForDecisions = (t: TournamentRecord) =>
  (OPEN_FOR_DECISIONS as readonly string[]).includes(t.status);

const paymentStatus = (t: TournamentRecord) =>
  t.config.participants.fee ? ('pending' as const) : ('not_required' as const);

/** Players the eligibility rules apply to: the coach is not one. */
const playersOf = (roster: readonly { userId: string; role: string }[]) =>
  roster.filter((r) => r.role !== 'coach').map((r) => r.userId);

/** Facts and active rosters of a set of users, loaded once. */
interface Evidence {
  readonly facts: Map<string, PlayerFacts>;
  readonly rosters: Map<string, RosterMembership[]>;
}

async function evidenceOf(deps: RegistrationsDeps, userIds: readonly string[]): Promise<Evidence> {
  const unique = [...new Set(userIds)];
  const [facts, rosters] = await Promise.all([
    deps.players.factsOf(unique),
    deps.registrations.activeRostersOf(unique),
  ]);
  return { facts, rosters };
}

function toPlayerProfile(userId: string, evidence: Evidence): PlayerProfile {
  const facts = evidence.facts.get(userId);
  const riot = facts?.riot ?? null;
  return {
    userId,
    riotAccountVerified: riot !== null,
    region: riot?.region ?? null,
    country: facts?.countryCode ?? null,
    rank: (riot?.rank ?? null) as Rank | null,
    rankHistory: (riot?.rankHistory ?? []).map((s) => ({
      rank: s.rank as Rank,
      takenAt: s.takenAt,
    })),
    accountLevel: riot?.summonerLevel ?? null,
    // Riot does not give the account creation date; the rule fails without it.
    accountCreatedAt: null,
    rankedGamesThisSeason: riot?.rankedGames ?? null,
    birthDate: facts?.birthDate ?? null,
    gender: facts?.gender ?? null,
    institution: facts?.institution ?? null,
    legalNameProvided: facts?.legalNameProvided ?? false,
    rosters: evidence.rosters.get(userId) ?? [],
    // Sanctions arrive with the integrity module.
    sanctions: [],
  };
}

/** The tournament rules (with its exclusivity scope) evaluated with packages/core. */
function evaluate(
  t: TournamentRecord,
  candidate: { entrantId: string | null; teamId: string | null; userIds: readonly string[] },
  evidence: Evidence,
  now: Date,
): EligibilityResult {
  const rules = effectiveEligibilityRules(
    t.config.eligibility.rules as unknown as EligibilityRule[],
    {
      exclusivityScope: t.config.eligibility.exclusivityScope,
      leaveCooldownDays: t.config.roster.leaveCooldownDays,
    },
  );
  return evaluateEligibility(
    {
      entrantId: candidate.entrantId,
      teamId: candidate.teamId,
      players: candidate.userIds.map((u) => toPlayerProfile(u, evidence)),
    },
    rules,
    {
      now: now.toISOString(),
      tournament: {
        id: t.id,
        tier: t.config.basics.tier,
        seasonId: t.config.basics.seasonId,
        circuitId: t.config.eligibility.circuitId,
      },
    },
  );
}

/** Failure for the API; `forCaptain` drops personal details of teammates. */
const toFailure =
  (forCaptain: boolean) =>
  (f: EligibilityResult['failed'][number]): EligibilityFailure => ({
    rule: f.rule,
    userId: f.userId,
    reason: f.reason,
    details: Object.fromEntries(
      Object.entries(f.details).filter(
        ([key]) => !forCaptain || !(PERSONAL_DETAILS[f.rule] ?? []).includes(key),
      ),
    ),
  });

const toViolation = (v: RosterViolation) => ({ reason: v.reason, details: { ...v.details } });

const canWithdraw = (e: EntrantRecord, t: TournamentRecord) =>
  ACTIVE_STATUSES.includes(e.status) && isOpenForDecisions(t);

function toMine(e: EntrantRecord, t: TournamentRecord): MyRegistration {
  return {
    id: e.id,
    tournament: { id: t.id, slug: t.slug, name: t.config.basics.name },
    teamId: e.teamId,
    status: e.status,
    displayName: e.displayName,
    waitlistPosition: e.waitlistPosition,
    rejectionReason: e.rejectionReason,
    paymentStatus: paymentStatus(t),
    canWithdraw: canWithdraw(e, t),
    registeredAt: e.createdAt.toISOString(),
  };
}

async function teamsIManage(deps: RegistrationsDeps, userId: string): Promise<TeamView[]> {
  const teams = await deps.teams.activeTeamsOf(userId);
  return teams
    .filter((t) => t.team.status === 'active' && teamCan(t.role, 'team:manage_roster'))
    .map((t) => t.team);
}

const sameRegistrant = (e: EntrantRecord, teamId: string | null, userId: string) =>
  teamId ? e.teamId === teamId : e.teamId === null && e.userId === userId;

/** Everything that decides a registration (shared by the live check and the submit). */
async function assess(
  deps: RegistrationsDeps,
  actorId: string,
  t: TournamentRecord,
  request: RegistrationCheckRequest,
) {
  const blockers: string[] = [];
  const now = deps.clock.now();
  const { registrationClosesAt } = t.config.schedule;
  if (
    t.status !== 'registration_open' ||
    (registrationClosesAt !== null && now.getTime() > Date.parse(registrationClosesAt))
  )
    blockers.push('registration_closed');

  const solo = t.config.participants.entrantKind === 'solo';
  let team: TeamView | null = null;
  let members: { userId: string; teamRole: Parameters<typeof teamCan>[0] }[] | null = null;
  if (solo) {
    if (request.teamId) blockers.push('solo_tournament');
    if (request.roster.length !== 1 || request.roster[0]?.userId !== actorId)
      blockers.push('solo_roster_self');
  } else if (!request.teamId) {
    blockers.push('team_required');
  } else {
    team = await deps.teams.findById(request.teamId);
    if (!team || team.status !== 'active') {
      blockers.push('team_not_active');
      team = null;
    } else {
      members = await deps.teams.activeMembers(team.id);
      const me = members.find((m) => m.userId === actorId);
      if (!me || !teamCan(me.teamRole, 'team:manage_roster')) blockers.push('not_team_manager');
      // Clubs arrive with their own module: every team is independent for now.
      if (t.config.participants.participantPolicy === 'clubs_only') blockers.push('clubs_only');
    }
  }

  const existing = (await deps.registrations.involving(team ? [team.id] : [], actorId)).find(
    (e) =>
      e.tournamentId === t.id &&
      ACTIVE_STATUSES.includes(e.status) &&
      sameRegistrant(e, team?.id ?? null, actorId),
  );
  if (existing) blockers.push('already_registered');

  const rosterViolations = validateRoster(
    {
      starters: t.config.roster.starters,
      maxSubstitutes: t.config.roster.maxSubstitutes,
      coachAllowed: t.config.roster.coachAllowed,
    },
    request.roster.map((r) => ({ userId: r.userId, role: r.role })),
    members ? members.map((m) => ({ userId: m.userId, role: m.teamRole })) : null,
  );

  const evidence = await evidenceOf(
    deps,
    request.roster.map((r) => r.userId),
  );
  const eligibility = evaluate(
    t,
    { entrantId: null, teamId: team?.id ?? null, userIds: playersOf(request.roster) },
    evidence,
    now,
  );
  return { blockers, rosterViolations, eligibility, team, evidence, now };
}

/** Staff view of registrations, eligibility evaluated now (rules or rosters may have changed). */
async function staffView(
  deps: RegistrationsDeps,
  t: TournamentRecord,
  list: readonly EntrantRecord[],
): Promise<Registration[]> {
  // Seeded first (by seed), then in order of arrival.
  const entrants = [...list].sort(
    (a, b) =>
      (a.seed ?? Number.MAX_SAFE_INTEGER) - (b.seed ?? Number.MAX_SAFE_INTEGER) ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const evidence = await evidenceOf(
    deps,
    entrants.flatMap((e) => e.roster.map((r) => r.userId)),
  );
  const [teams, versions] = await Promise.all([
    Promise.all(
      entrants.map((e) => (e.teamId ? deps.teams.findById(e.teamId) : Promise.resolve(null))),
    ),
    deps.tournaments.rulebookVersionNumbers(t.id),
  ]);
  const now = deps.clock.now();
  return entrants.map((e, i) => {
    const result = evaluate(
      t,
      { entrantId: e.id, teamId: e.teamId, userIds: playersOf(e.roster) },
      evidence,
      now,
    );
    const team = teams[i];
    return {
      id: e.id,
      tournamentId: e.tournamentId,
      status: e.status,
      displayName: e.displayName,
      displayTag: e.displayTag,
      logoUrl: deps.teams.logoUrl(e.logoPath),
      team: team ? { id: team.id, slug: team.slug } : null,
      seed: e.seed,
      waitlistPosition: e.waitlistPosition,
      rejectionReason: e.rejectionReason,
      paymentStatus: paymentStatus(t),
      rulebookVersion: e.rulebookVersionId ? (versions.get(e.rulebookVersionId) ?? null) : null,
      roster: e.roster.map((r) => {
        const facts = evidence.facts.get(r.userId);
        return {
          userId: r.userId,
          username: facts?.username ?? null,
          displayName: facts?.displayName ?? null,
          avatarUrl: facts?.avatarUrl ?? null,
          role: r.role,
          gameRole: r.gameRole,
          riotId: facts?.riot?.riotId ?? null,
        };
      }),
      eligibility: { eligible: result.eligible, failures: result.failed.map(toFailure(false)) },
      registeredAt: e.createdAt.toISOString(),
    };
  });
}

async function participantsOf(
  deps: RegistrationsDeps,
  entrants: readonly EntrantRecord[],
): Promise<PublicParticipant[]> {
  const approved = entrants
    .filter((e) => e.status === 'approved')
    .sort(
      (a, b) => (a.seed ?? 999) - (b.seed ?? 999) || a.displayName.localeCompare(b.displayName),
    );
  const teams = await Promise.all(
    approved.map((e) => (e.teamId ? deps.teams.findById(e.teamId) : Promise.resolve(null))),
  );
  return approved.map((e, i) => ({
    displayName: e.displayName,
    displayTag: e.displayTag,
    logoUrl: deps.teams.logoUrl(e.logoPath),
    teamSlug: teams[i]?.slug ?? null,
    seed: e.seed,
  }));
}

/** Public tournaments players can see: published, not private. */
const isVisible = (t: TournamentRecord) =>
  t.status !== 'draft' && t.config.basics.visibility !== 'private';

// ---------------------------------------------------------------------------
// Portal: check, register, withdraw, explore
// ---------------------------------------------------------------------------

export class CheckRegistrationUseCase {
  constructor(private readonly deps: RegistrationsDeps) {}

  async execute(
    userId: string,
    tournamentId: string,
    input: RegistrationCheckRequest,
  ): Promise<RegistrationCheck> {
    const t = await loadTournament(this.deps, tournamentId);
    if (!isVisible(t)) throw notFound('tournament_not_found');
    const { blockers, rosterViolations, eligibility } = await assess(this.deps, userId, t, input);
    return {
      ok: blockers.length === 0 && rosterViolations.length === 0 && eligibility.eligible,
      blockers,
      rosterViolations: rosterViolations.map(toViolation),
      failures: eligibility.failed.map(toFailure(true)),
    };
  }
}

export class RegisterUseCase {
  constructor(private readonly deps: RegistrationsDeps) {}

  async execute(
    userId: string,
    tournamentId: string,
    input: RegisterRequest,
  ): Promise<MyRegistration> {
    const t = await loadTournament(this.deps, tournamentId);
    if (!isVisible(t)) throw notFound('tournament_not_found');
    const { blockers, rosterViolations, eligibility, team, evidence, now } = await assess(
      this.deps,
      userId,
      t,
      input,
    );
    const rulebook = await this.deps.tournaments.currentRulebook(t);
    if ((rulebook?.id ?? null) !== input.rulebookVersionId) blockers.push('rulebook_outdated');
    if (blockers.length > 0 || rosterViolations.length > 0)
      throw conflict('registration_blocked', {
        blockers,
        rosterViolations: rosterViolations.map(toViolation),
      });
    if (!eligibility.eligible)
      throw conflict('registration_ineligible', {
        failures: eligibility.failed.map(toFailure(true)),
      });

    const scope = t.config.eligibility.exclusivityScope;
    const ref = {
      id: t.id,
      seasonId: t.config.basics.seasonId,
      circuitId: t.config.eligibility.circuitId,
    };
    const roster: RosterRecord[] = input.roster.map((r) => ({
      userId: r.userId,
      riotAccountId: evidence.facts.get(r.userId)?.riot?.accountId ?? null,
      role: r.role,
      gameRole: r.gameRole,
      exclusivityKey:
        r.role === 'coach'
          ? null
          : rosterExclusivityKey(
              scope,
              ref,
              team?.id ?? null,
              evidence.rosters.get(r.userId) ?? [],
              now.toISOString(),
            ),
    }));
    const me = evidence.facts.get(userId);
    const id = await this.deps.registrations.register({
      tournamentId,
      actorId: userId,
      entrant: team
        ? {
            teamId: team.id,
            userId: null,
            displayName: team.name,
            displayTag: team.tag,
            logoPath: team.logoPath,
            rulebookVersionId: input.rulebookVersionId,
            eligibility,
          }
        : {
            teamId: null,
            userId,
            displayName: me?.displayName ?? me?.username ?? me?.riot?.riotId ?? userId.slice(0, 8),
            displayTag: null,
            logoPath: null,
            rulebookVersionId: input.rulebookVersionId,
            eligibility,
          },
      roster,
    });
    return toMine(await loadEntrant(this.deps, id), t);
  }
}

export class WithdrawRegistrationUseCase {
  constructor(private readonly deps: RegistrationsDeps) {}

  async execute(userId: string, entrantId: string): Promise<MyRegistration> {
    const entrant = await loadEntrant(this.deps, entrantId);
    const t = await loadTournament(this.deps, entrant.tournamentId);
    const managesTeam =
      entrant.teamId !== null &&
      (await this.deps.teams.activeMembers(entrant.teamId)).some(
        (m) => m.userId === userId && teamCan(m.teamRole, 'team:manage_roster'),
      );
    if (entrant.registeredBy !== userId && entrant.userId !== userId && !managesTeam)
      throw forbidden('not_registration_owner');
    if (!isOpenForDecisions(t)) throw conflict('withdraw_closed');
    const to = entrantLifecycle.transition(
      entrant.status,
      { type: 'withdraw' },
      {
        approvedEntrants: 0,
        capacity: null,
      },
    );
    await this.deps.registrations.decide(entrantId, userId, {
      from: entrant.status,
      to,
      auditAction: null,
      event: 'registration.withdrawn',
      reason: null,
    });
    return toMine(await loadEntrant(this.deps, entrantId), t);
  }
}

export class ExploreTournamentsUseCase {
  constructor(private readonly deps: RegistrationsDeps) {}

  /** Upcoming and open tournaments, each with "eligible / not because…" per way to take part. */
  async execute(userId: string): Promise<ExploreTournament[]> {
    const { tournaments } = await this.deps.tournaments.list({
      statuses: ['published', 'registration_open', 'registration_closed'],
      publicOnly: true,
      limit: 50,
      offset: 0,
    });
    const myTeams = await teamsIManage(this.deps, userId);
    const members = new Map(
      await Promise.all(
        myTeams.map(
          async (team) => [team.id, await this.deps.teams.activeMembers(team.id)] as const,
        ),
      ),
    );
    const playing = (teamId: string) =>
      (members.get(teamId) ?? [])
        .filter((m) => m.teamRole !== 'coach' && m.teamRole !== 'manager')
        .map((m) => m.userId);
    const [evidence, mine, counts] = await Promise.all([
      evidenceOf(this.deps, [userId, ...myTeams.flatMap((t) => playing(t.id))]),
      this.deps.registrations.involving(
        myTeams.map((t) => t.id),
        userId,
      ),
      this.deps.registrations.counts(tournaments.map((t) => t.id)),
    ]);
    const now = this.deps.clock.now();

    return tournaments.map((t) => {
      const closed = t.status === 'registration_open' ? [] : ['registration_closed'];
      const option = (
        teamId: string | null,
        label: string,
        userIds: readonly string[],
        blockers: string[],
      ): RegistrationOption => {
        const registration = mine.find(
          (e) =>
            e.tournamentId === t.id &&
            ACTIVE_STATUSES.includes(e.status) &&
            sameRegistrant(e, teamId, userId),
        );
        const result = evaluate(
          t,
          { entrantId: registration?.id ?? null, teamId, userIds },
          evidence,
          now,
        );
        return {
          teamId,
          label,
          eligible: result.eligible,
          failures: result.failed.map(toFailure(true)),
          blockers: [...closed, ...blockers],
          registration: registration ? { id: registration.id, status: registration.status } : null,
        };
      };
      const options =
        t.config.participants.entrantKind === 'solo'
          ? [option(null, '', [userId], [])]
          : myTeams.length > 0
            ? myTeams.map((team) => option(team.id, team.name, playing(team.id), []))
            : [option(null, '', [userId], ['not_team_manager'])];
      return {
        ...this.deps.tournaments.listItem(t, counts.get(t.id)?.approved ?? 0),
        options,
      };
    });
  }
}

export class GetRegistrationContextUseCase {
  constructor(private readonly deps: RegistrationsDeps) {}

  async execute(userId: string, slug: string): Promise<RegistrationContext> {
    const t = await this.deps.tournaments.findBySlug(slug);
    if (!t || !isVisible(t)) throw notFound('tournament_not_found');
    const myTeams = await teamsIManage(this.deps, userId);
    const [entrants, mine, teamMembers] = await Promise.all([
      this.deps.registrations.listByTournament(t.id),
      this.deps.registrations.involving(
        myTeams.map((team) => team.id),
        userId,
      ),
      Promise.all(myTeams.map((team) => this.deps.teams.activeMembers(team.id))),
    ]);
    const evidence = await evidenceOf(this.deps, [
      userId,
      ...teamMembers.flat().map((m) => m.userId),
    ]);
    const me = evidence.facts.get(userId);
    return {
      tournament: await this.deps.tournaments.publicDetail(
        t,
        await participantsOf(this.deps, entrants),
      ),
      teams: myTeams.map((team, i) => ({
        id: team.id,
        slug: team.slug,
        name: team.name,
        tag: team.tag,
        logoUrl: this.deps.teams.logoUrl(team.logoPath),
        members: (teamMembers[i] ?? []).map((m) => ({
          userId: m.userId,
          username: evidence.facts.get(m.userId)?.username ?? null,
          displayName: evidence.facts.get(m.userId)?.displayName ?? null,
          teamRole: m.teamRole,
          gameRole: (m.gameRole ??
            null) as RegistrationContext['teams'][number]['members'][number]['gameRole'],
        })),
      })),
      me: { userId, username: me?.username ?? null, displayName: me?.displayName ?? null },
      myRegistrations: mine.filter((e) => e.tournamentId === t.id).map((e) => toMine(e, t)),
    };
  }
}

export class ListMyRegistrationsUseCase {
  constructor(private readonly deps: RegistrationsDeps) {}

  async execute(userId: string): Promise<MyRegistration[]> {
    const myTeams = await teamsIManage(this.deps, userId);
    const mine = await this.deps.registrations.involving(
      myTeams.map((t) => t.id),
      userId,
    );
    const tournaments = new Map<string, TournamentRecord>();
    for (const id of new Set(mine.map((e) => e.tournamentId))) {
      const t = await this.deps.tournaments.findById(id);
      if (t) tournaments.set(id, t);
    }
    return mine.flatMap((e) => {
      const t = tournaments.get(e.tournamentId);
      return t ? [toMine(e, t)] : [];
    });
  }
}

// ---------------------------------------------------------------------------
// Staff: review, decide, seed
// ---------------------------------------------------------------------------

export class ListRegistrationsUseCase {
  constructor(private readonly deps: RegistrationsDeps) {}

  async execute(userId: string, tournamentId: string): Promise<Registration[]> {
    await requireStaff(this.deps, userId);
    const t = await loadTournament(this.deps, tournamentId);
    return staffView(this.deps, t, await this.deps.registrations.listByTournament(tournamentId));
  }
}

export class RegistrationCountsUseCase {
  constructor(private readonly deps: RegistrationsDeps) {}

  async execute(userId: string, tournamentIds: readonly string[]): Promise<RegistrationCounts> {
    await requireStaff(this.deps, userId);
    return Object.fromEntries(await this.deps.registrations.counts(tournamentIds));
  }
}

const DECISIONS = {
  approve: { event: 'approve', audit: 'registration.approved' },
  reject: { event: 'reject', audit: 'registration.rejected' },
  promote: { event: 'promote', audit: 'registration.promoted' },
  disqualify: { event: 'disqualify', audit: 'registration.disqualified' },
} as const;

export class DecideRegistrationUseCase {
  constructor(private readonly deps: RegistrationsDeps) {}

  async execute(
    userId: string,
    entrantId: string,
    input: DecideRegistrationRequest,
  ): Promise<Registration> {
    await requireStaff(this.deps, userId);
    const entrant = await loadEntrant(this.deps, entrantId);
    const t = await loadTournament(this.deps, entrant.tournamentId);
    if (!isOpenForDecisions(t)) throw conflict('decisions_closed');

    let auditAction: string = DECISIONS[input.decision].audit;
    if (input.decision === 'reject' || input.decision === 'disqualify') requireReason(input.reason);
    if (input.decision === 'approve') {
      const evidence = await evidenceOf(
        this.deps,
        entrant.roster.map((r) => r.userId),
      );
      const result = evaluate(
        t,
        { entrantId: entrant.id, teamId: entrant.teamId, userIds: playersOf(entrant.roster) },
        evidence,
        this.deps.clock.now(),
      );
      if (!result.eligible) {
        // Manual exception (docs/13 §4): explicit, with a reason, audited as such.
        if (!input.overrideEligibility)
          throw conflict('registration_ineligible', {
            failures: result.failed.map(toFailure(false)),
          });
        requireReason(input.reason);
        auditAction = 'registration.approved_with_exception';
      }
    }

    const approved = (await this.deps.registrations.counts([t.id])).get(t.id)?.approved ?? 0;
    const to = entrantLifecycle.transition(
      entrant.status,
      { type: DECISIONS[input.decision].event },
      { approvedEntrants: approved, capacity: t.config.capacity.capacity },
    );
    await this.deps.registrations.decide(entrantId, userId, {
      from: entrant.status,
      to,
      auditAction,
      event: DECISIONS[input.decision].audit,
      reason: input.reason,
    });
    const [view] = await staffView(this.deps, t, [await loadEntrant(this.deps, entrantId)]);
    return view as Registration;
  }
}

export class SeedRegistrationsUseCase {
  constructor(private readonly deps: RegistrationsDeps) {}

  async execute(
    userId: string,
    tournamentId: string,
    input: SeedingRequest,
  ): Promise<Registration[]> {
    await requireStaff(this.deps, userId);
    const t = await loadTournament(this.deps, tournamentId);
    if (t.status !== 'registration_closed' && t.status !== 'seeding')
      throw conflict('seeding_closed');
    const approved = (await this.deps.registrations.listByTournament(tournamentId)).filter(
      (e) => e.status === 'approved',
    );
    const evidence = await evidenceOf(
      this.deps,
      approved.flatMap((e) => e.roster.map((r) => r.userId)),
    );
    const seeds = seedEntrants(
      input.method,
      approved.map((e) => ({
        entrantId: e.id,
        averageRank: averageRankValue(
          e.roster
            .filter((r) => r.role === 'starter')
            .map((r) => (evidence.facts.get(r.userId)?.riot?.rank ?? null) as Rank | null),
        ),
        registeredAt: e.createdAt.toISOString(),
      })),
      {
        manual: Object.fromEntries(input.seeds.map((s) => [s.entrantId, s.seed])),
        random: this.deps.random,
      },
    );
    await this.deps.registrations.setSeeds(tournamentId, userId, input.method, seeds);
    return staffView(this.deps, t, await this.deps.registrations.listByTournament(tournamentId));
  }
}

// ---------------------------------------------------------------------------
// Read API for the public site
// ---------------------------------------------------------------------------

export class RegistrationQueries {
  constructor(private readonly deps: RegistrationsDeps) {}

  async participants(tournamentId: string): Promise<PublicParticipant[]> {
    return participantsOf(this.deps, await this.deps.registrations.listByTournament(tournamentId));
  }

  async approvedCounts(tournamentIds: readonly string[]): Promise<Map<string, number>> {
    const counts = await this.deps.registrations.counts(tournamentIds);
    return new Map([...counts].map(([id, c]) => [id, c.approved]));
  }
}
