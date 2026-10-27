// One definition per eligibility rule type. Adding a rule means adding an
// entry here; params come from data (jsonb), so they are validated at runtime.

import { InvalidEligibilityRuleError } from '../errors.js';
import type {
  EligibilityCandidate,
  EligibilityContext,
  ExclusivityScope,
  PlayerProfile,
  RosterMembership,
} from './eligibility.js';
import { formatRank, isApexTier, rankFromValue, rankValue, RANK_TIERS, type Rank } from './rank.js';
import { rule, specification, type Specification } from './specification.js';

export interface PlayerSubject {
  readonly player: PlayerProfile;
  readonly candidate: EligibilityCandidate;
  readonly context: EligibilityContext;
}

export interface TeamSubject {
  readonly candidate: EligibilityCandidate;
  readonly context: EligibilityContext;
}

export interface RuleDefinition {
  player(type: string, params: unknown): Specification<PlayerSubject>;
  teamAverage(type: string, params: unknown): Specification<TeamSubject>;
}

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// Param parsing
// ---------------------------------------------------------------------------

type Params = Readonly<Record<string, unknown>>;

function invalid(type: string, field: string, value: unknown): never {
  throw new InvalidEligibilityRuleError(`Invalid params for rule ${type}: ${field}`, {
    rule: type,
    field,
    value,
  });
}

function paramsOf(type: string, params: unknown): Params {
  if (params === undefined) return {};
  if (typeof params !== 'object' || params === null || Array.isArray(params))
    invalid(type, 'params', params);
  return params as Params;
}

function count(type: string, params: Params, field: string): number {
  const value = params[field];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0)
    invalid(type, field, value);
  return value;
}

function strings(
  type: string,
  params: Params,
  field: string,
  optional = false,
): string[] | undefined {
  const value = params[field];
  if (value === undefined && optional) return undefined;
  if (!Array.isArray(value) || !value.every((v): v is string => typeof v === 'string')) {
    invalid(type, field, value);
  }
  return value;
}

function date(type: string, params: Params, field: string): string | undefined {
  const value = params[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) invalid(type, field, value);
  return value;
}

function rank(type: string, params: Params): Rank {
  const value = params['rank'];
  if (typeof value !== 'object' || value === null) invalid(type, 'rank', value);
  const { tier, division } = value as { tier?: unknown; division?: unknown };
  const knownTier = RANK_TIERS.find((t) => t === tier);
  if (!knownTier) invalid(type, 'rank.tier', tier);
  if (isApexTier(knownTier)) {
    if (division !== undefined) invalid(type, 'rank.division', division);
    return { tier: knownTier };
  }
  if (division !== 1 && division !== 2 && division !== 3 && division !== 4)
    invalid(type, 'rank.division', division);
  return { tier: knownTier, division };
}

// ---------------------------------------------------------------------------
// Helpers over the subject
// ---------------------------------------------------------------------------

const time = (iso: string | null | undefined) => (iso ? Date.parse(iso) : Number.NaN);

function ageInYears(birthDate: string, now: string): number {
  const [y, m, d] = birthDate.split('-').map(Number);
  const today = new Date(now);
  const year = today.getUTCFullYear() - (y ?? 0);
  const beforeBirthday =
    today.getUTCMonth() + 1 < (m ?? 1) ||
    (today.getUTCMonth() + 1 === (m ?? 1) && today.getUTCDate() < (d ?? 1));
  return beforeBirthday ? year - 1 : year;
}

function peakRank(player: PlayerProfile, now: string, windowDays: number): Rank | null {
  const since = time(now) - windowDays * DAY_MS;
  const inWindow = (player.rankHistory ?? []).filter(
    (s) => time(s.takenAt) >= since && time(s.takenAt) <= time(now),
  );
  return [player.rank ?? null, ...inWindow.map((s) => s.rank)].reduce<Rank | null>(
    (best, r) => (rankValue(r) > rankValue(best) ? r : best),
    null,
  );
}

export const isActive = (roster: RosterMembership, now: string) =>
  roster.leftAt === null || time(roster.leftAt) > time(now);

/** Another registration than the candidate's: a different team, or a different ad-hoc entrant. */
function isOtherRoster(roster: RosterMembership, candidate: EligibilityCandidate): boolean {
  if (candidate.teamId !== null && roster.teamId === candidate.teamId) return false;
  return roster.entrantId !== candidate.entrantId;
}

/** Whether a roster falls inside an exclusivity scope of the tournament in `context`. */
export function inScope(
  roster: RosterMembership,
  scope: ExclusivityScope,
  context: EligibilityContext,
): boolean {
  const { tournament } = context;
  switch (scope) {
    case 'none':
      return false;
    case 'tournament':
      return roster.tournamentId === tournament.id;
    case 'circuit':
      return tournament.circuitId !== null && roster.circuitId === tournament.circuitId;
    case 'season':
      return tournament.seasonId !== null && roster.seasonId === tournament.seasonId;
  }
}

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

/** A rule that only exists per player. */
function perPlayer(
  build: (type: string, params: Params) => Specification<PlayerSubject>,
): RuleDefinition {
  return {
    player: (type, params) => build(type, paramsOf(type, params)),
    teamAverage: (type) => invalid(type, 'appliesTo', 'team_average'),
  };
}

/** Rank rules: per player, or on the roster average (floored to a division). */
function rankRule(
  bound: 'min' | 'max',
  readRank: (player: PlayerProfile, params: Params, type: string, now: string) => Rank | null,
  playerReason: string,
  extraDetails: (type: string, params: Params) => Readonly<Record<string, number>> = () => ({}),
): RuleDefinition {
  const within = (value: number, limit: Rank) =>
    bound === 'max' ? value <= rankValue(limit) : value >= rankValue(limit);
  return {
    player: (type, raw) => {
      const params = paramsOf(type, raw);
      const limit = rank(type, params);
      const extra = extraDetails(type, params);
      return specification(({ player, context }) => {
        const actual = readRank(player, params, type, context.now);
        if (within(rankValue(actual), limit)) return [];
        const key = playerReason === 'peak_rank_above_max' ? 'peak' : 'rank';
        return [
          {
            reason: playerReason,
            details: { [key]: formatRank(actual), [bound]: formatRank(limit), ...extra },
          },
        ];
      });
    },
    teamAverage: (type, raw) => {
      const params = paramsOf(type, raw);
      const limit = rank(type, params);
      extraDetails(type, params);
      return specification(({ candidate, context }) => {
        const values = candidate.players.map((p) =>
          rankValue(readRank(p, params, type, context.now)),
        );
        const average = Math.floor(
          values.reduce((sum, v) => sum + v, 0) / Math.max(values.length, 1),
        );
        if (within(average, limit)) return [];
        return [
          {
            reason: bound === 'max' ? 'team_average_above_max' : 'team_average_below_min',
            details: { average: formatRank(rankFromValue(average)), [bound]: formatRank(limit) },
          },
        ];
      });
    },
  };
}

const currentRank = (player: PlayerProfile) => player.rank ?? null;
const peakInWindow = (player: PlayerProfile, params: Params, type: string, now: string) =>
  peakRank(player, now, count(type, params, 'windowDays'));

const DEFAULT_GENDERS = ['woman', 'non_binary'];

export const ELIGIBILITY_RULES: Readonly<Record<string, RuleDefinition>> = {
  riot_account_verified: perPlayer(() =>
    rule(({ player }) => player.riotAccountVerified === true, 'riot_account_not_verified'),
  ),

  region: perPlayer((type, params) => {
    const allowed = (strings(type, params, 'regions') ?? []).map((r) => r.toUpperCase());
    return rule(
      ({ player }) => allowed.includes((player.region ?? '').toUpperCase()),
      'region_not_allowed',
      ({ player }) => ({ region: player.region ?? '', allowed: allowed.join(', ') }),
    );
  }),

  country: perPlayer((type, params) => {
    const allowed = (strings(type, params, 'countries') ?? []).map((c) => c.toUpperCase());
    return rule(
      ({ player }) => allowed.includes((player.country ?? '').toUpperCase()),
      'country_not_allowed',
      ({ player }) => ({ country: player.country ?? '', allowed: allowed.join(', ') }),
    );
  }),

  rank_min: rankRule('min', currentRank, 'rank_below_min'),
  rank_max: rankRule('max', currentRank, 'rank_above_max'),
  peak_rank_max: rankRule('max', peakInWindow, 'peak_rank_above_max', (type, params) => ({
    windowDays: count(type, params, 'windowDays'),
  })),

  account_level_min: perPlayer((type, params) => {
    const min = count(type, params, 'level');
    return rule(
      ({ player }) => (player.accountLevel ?? -1) >= min,
      'account_level_below_min',
      ({ player }) => ({ level: player.accountLevel ?? 0, min }),
    );
  }),

  account_age_min: perPlayer((type, params) => {
    const min = count(type, params, 'days');
    const days = ({ player, context }: PlayerSubject) =>
      Math.floor((time(context.now) - time(player.accountCreatedAt)) / DAY_MS);
    return rule(
      (s) => days(s) >= min,
      'account_too_new',
      (s) => ({ days: Number.isNaN(days(s)) ? 0 : days(s), min }),
    );
  }),

  ranked_games_min: perPlayer((type, params) => {
    const min = count(type, params, 'games');
    return rule(
      ({ player }) => (player.rankedGamesThisSeason ?? 0) >= min,
      'ranked_games_below_min',
      ({ player }) => ({ games: player.rankedGamesThisSeason ?? 0, min }),
    );
  }),

  age_min: perPlayer((type, params) => {
    const min = count(type, params, 'years');
    const known = rule<PlayerSubject>(
      ({ player }) => Boolean(player.birthDate),
      'birth_date_missing',
    );
    const oldEnough = rule<PlayerSubject>(
      ({ player, context }) => ageInYears(player.birthDate ?? '', context.now) >= min,
      'underage',
      ({ player, context }) => ({ age: ageInYears(player.birthDate ?? '', context.now), min }),
    );
    return known.and(oldEnough);
  }),

  gender: perPlayer((type, params) => {
    const allowed = strings(type, params, 'allowed', true) ?? DEFAULT_GENDERS;
    const deadline = date(type, params, 'declaredBefore');
    const declared = rule<PlayerSubject>(
      ({ player }) => Boolean(player.gender),
      'gender_not_declared',
    );
    const permitted = rule<PlayerSubject>(
      ({ player }) => allowed.includes(player.gender?.value ?? ''),
      'gender_not_allowed',
    );
    const inTime = rule<PlayerSubject>(
      ({ player }) => deadline === undefined || time(player.gender?.declaredAt) < time(deadline),
      'gender_declared_too_late',
      ({ player }) => ({ declaredAt: player.gender?.declaredAt ?? '', deadline: deadline ?? '' }),
    );
    return declared.and(permitted).and(inTime);
  }),

  institution: perPlayer((type, params) => {
    const institutionId = params['institutionId'];
    const domains = (strings(type, params, 'emailDomains', true) ?? []).map((d) => d.toLowerCase());
    if (institutionId !== undefined && typeof institutionId !== 'string')
      invalid(type, 'institutionId', institutionId);
    if (institutionId === undefined && domains.length === 0)
      invalid(type, 'institutionId', undefined);

    const verified = rule<PlayerSubject>(
      ({ player }) => player.institution?.verified === true,
      'institution_not_verified',
    );
    const sameInstitution = rule<PlayerSubject>(
      ({ player }) => institutionId !== undefined && player.institution?.id === institutionId,
      'institution_mismatch',
    );
    const sameDomain = rule<PlayerSubject>(({ player }) => {
      const domain = player.institution?.email.split('@').at(1)?.toLowerCase() ?? '';
      return domains.includes(domain);
    }, 'institution_mismatch');
    return verified.and(sameInstitution.or(sameDomain));
  }),

  max_tier_roster: perPlayer((type, params) => {
    const tier = params['tier'];
    if (tier !== 1 && tier !== 2 && tier !== 3) invalid(type, 'tier', tier);
    return specification(({ player, candidate, context }) =>
      (player.rosters ?? [])
        .filter(
          (r) => isActive(r, context.now) && r.entrantId !== candidate.entrantId && r.tier <= tier,
        )
        .map((r) => ({
          reason: 'active_roster_in_restricted_tier',
          details: { tier: r.tier, tournamentId: r.tournamentId },
        })),
    );
  }),

  exclusivity: perPlayer((type, params) => {
    const scope = params['scope'];
    if (scope !== 'none' && scope !== 'tournament' && scope !== 'circuit' && scope !== 'season') {
      invalid(type, 'scope', scope);
    }
    const cooldownDays =
      params['cooldownDays'] === undefined ? 0 : count(type, params, 'cooldownDays');
    return specification(({ player, candidate, context }) => {
      const relevant = (player.rosters ?? []).filter(
        (r) => inScope(r, scope, context) && isOtherRoster(r, candidate),
      );
      const conflicts = relevant
        .filter((r) => isActive(r, context.now))
        .map((r) => ({
          reason: 'exclusivity_conflict',
          details: { scope, tournamentId: r.tournamentId, entrantId: r.entrantId },
        }));
      const cooling = relevant
        .filter(
          (r) =>
            !isActive(r, context.now) && time(r.leftAt) + cooldownDays * DAY_MS > time(context.now),
        )
        .map((r) => ({
          reason: 'exclusivity_cooldown',
          details: {
            scope,
            availableAt: new Date(time(r.leftAt) + cooldownDays * DAY_MS).toISOString(),
          },
        }));
      return [...conflicts, ...cooling];
    });
  }),

  not_sanctioned: perPlayer(() =>
    specification(({ player, context }) =>
      (player.sanctions ?? [])
        .filter(
          (s) =>
            time(s.startsAt) <= time(context.now) &&
            (s.endsAt === null || time(s.endsAt) > time(context.now)),
        )
        .map((s) => ({ reason: 'sanctioned', details: { until: s.endsAt ?? 'permanent' } })),
    ),
  ),

  legal_name_required: perPlayer(() =>
    rule(({ player }) => player.legalNameProvided === true, 'legal_name_missing'),
  ),
};
