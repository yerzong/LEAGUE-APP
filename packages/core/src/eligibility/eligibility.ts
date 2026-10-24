// Eligibility engine: each rule of docs/13-reglas-integridad.md §5 is a
// Specification, evaluated against the players of a candidate entrant.

import { IneligibleEntrantError, UnknownEligibilityRuleError } from '../errors.js';
import type { EntrantId } from '../types.js';
import type { Rank } from './rank.js';
import { ELIGIBILITY_RULES, type RuleDefinition } from './rules.js';
import type { FailureDetails } from './specification.js';

/** Timestamps are ISO 8601 strings, as they come from the database. */
export type IsoDateTime = string;

export interface RankSnapshot {
  readonly rank: Rank | null;
  readonly takenAt: IsoDateTime;
}

export interface RosterMembership {
  readonly entrantId: EntrantId;
  /** `null` for ad-hoc entrants. */
  readonly teamId: string | null;
  readonly tournamentId: string;
  readonly seasonId: string | null;
  readonly circuitId: string | null;
  readonly tier: 1 | 2 | 3;
  readonly joinedAt: IsoDateTime;
  readonly leftAt: IsoDateTime | null;
}

/** A sanction that blocks registration (the caller filters out warnings and the like). */
export interface SanctionPeriod {
  readonly startsAt: IsoDateTime;
  readonly endsAt: IsoDateTime | null;
}

/** What the engine knows about a player. Missing data fails the rules that need it. */
export interface PlayerProfile {
  readonly userId: string;
  readonly riotAccountVerified?: boolean;
  readonly region?: string | null;
  readonly country?: string | null;
  readonly rank?: Rank | null;
  readonly rankHistory?: readonly RankSnapshot[];
  readonly accountLevel?: number | null;
  readonly accountCreatedAt?: IsoDateTime | null;
  readonly rankedGamesThisSeason?: number | null;
  /** `YYYY-MM-DD`. */
  readonly birthDate?: string | null;
  readonly gender?: { readonly value: string; readonly declaredAt: IsoDateTime } | null;
  readonly institution?: {
    readonly id: string;
    readonly email: string;
    readonly verified: boolean;
  } | null;
  readonly legalNameProvided?: boolean;
  readonly rosters?: readonly RosterMembership[];
  readonly sanctions?: readonly SanctionPeriod[];
}

export interface EligibilityCandidate {
  /** The registration being evaluated, if it already exists. */
  readonly entrantId: EntrantId | null;
  readonly teamId: string | null;
  readonly players: readonly PlayerProfile[];
}

export interface EligibilityContext {
  readonly now: IsoDateTime;
  readonly tournament: {
    readonly id: string;
    readonly tier: 1 | 2 | 3;
    readonly seasonId: string | null;
    readonly circuitId: string | null;
  };
}

export type ExclusivityScope = 'none' | 'tournament' | 'circuit' | 'season';

/** `player` and `roster` check every member; `team_average` (rank rules only) checks the average. */
export type RuleTarget = 'player' | 'roster' | 'team_average';

type Rule<T extends string, P = undefined> = P extends undefined
  ? { readonly type: T; readonly params?: undefined; readonly appliesTo?: RuleTarget }
  : { readonly type: T; readonly params: P; readonly appliesTo?: RuleTarget };

export type EligibilityRule =
  | Rule<'riot_account_verified'>
  | Rule<'region', { readonly regions: readonly string[] }>
  | Rule<'country', { readonly countries: readonly string[] }>
  | Rule<'rank_min', { readonly rank: Rank }>
  | Rule<'rank_max', { readonly rank: Rank }>
  | Rule<'peak_rank_max', { readonly rank: Rank; readonly windowDays: number }>
  | Rule<'account_level_min', { readonly level: number }>
  | Rule<'account_age_min', { readonly days: number }>
  | Rule<'ranked_games_min', { readonly games: number }>
  | Rule<'age_min', { readonly years: number }>
  | Rule<'gender', { readonly allowed?: readonly string[]; readonly declaredBefore?: IsoDateTime }>
  | Rule<
      'institution',
      { readonly institutionId?: string; readonly emailDomains?: readonly string[] }
    >
  | Rule<'max_tier_roster', { readonly tier: 1 | 2 | 3 }>
  | Rule<'exclusivity', { readonly scope: ExclusivityScope; readonly cooldownDays?: number }>
  | Rule<'not_sanctioned'>
  | Rule<'legal_name_required'>;

export type EligibilityRuleType = EligibilityRule['type'];

export interface EligibilityFailure {
  /** Index of the rule in the list (rules are ordered). */
  readonly position: number;
  readonly rule: string;
  /** `null` when the rule failed for the entrant as a whole (team average). */
  readonly userId: string | null;
  readonly reason: string;
  readonly details: FailureDetails;
}

export interface EligibilityResult {
  readonly eligible: boolean;
  readonly passed: readonly { readonly position: number; readonly rule: string }[];
  readonly failed: readonly EligibilityFailure[];
}

/** Evaluates every rule; failures carry a reason code the portal turns into "you are not eligible because…". */
export function evaluateEligibility(
  candidate: EligibilityCandidate,
  rules: readonly EligibilityRule[],
  context: EligibilityContext,
  definitions: Readonly<Record<string, RuleDefinition>> = ELIGIBILITY_RULES,
): EligibilityResult {
  const passed: { position: number; rule: string }[] = [];
  const failed: EligibilityFailure[] = [];

  rules.forEach((rule, position) => {
    const definition = definitions[rule.type];
    if (!definition) {
      throw new UnknownEligibilityRuleError(`Unknown eligibility rule: ${rule.type}`, {
        rule: rule.type,
      });
    }
    const failures =
      rule.appliesTo === 'team_average'
        ? definition
            .teamAverage(rule.type, rule.params)
            .check({ candidate, context })
            .map((f) => ({ position, rule: rule.type, userId: null, ...f }))
        : playerFailures(definition, rule, candidate, context).map((f) => ({
            position,
            rule: rule.type,
            ...f,
          }));
    if (failures.length === 0) {
      passed.push({ position, rule: rule.type });
    } else {
      failed.push(...failures);
    }
  });

  return { eligible: failed.length === 0, passed, failed };
}

function playerFailures(
  definition: RuleDefinition,
  rule: EligibilityRule,
  candidate: EligibilityCandidate,
  context: EligibilityContext,
) {
  const spec = definition.player(rule.type, rule.params);
  return candidate.players.flatMap((player) =>
    spec.check({ player, candidate, context }).map((f) => ({ userId: player.userId, ...f })),
  );
}

export function assertEligible(
  candidate: EligibilityCandidate,
  rules: readonly EligibilityRule[],
  context: EligibilityContext,
): void {
  const result = evaluateEligibility(candidate, rules, context);
  if (!result.eligible) {
    throw new IneligibleEntrantError('The entrant does not meet the eligibility rules', {
      failures: result.failed,
    });
  }
}
