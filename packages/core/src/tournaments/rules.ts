// Which eligibility rules apply to a tournament, and the exclusivity key its
// roster rows store (docs/03 §6.2: the partial unique index on
// entrant_roster_members is the anti-chapulineo guaranteed by the database).

import type {
  EligibilityContext,
  EligibilityRule,
  ExclusivityScope,
  IsoDateTime,
  RosterMembership,
} from '../eligibility/eligibility.js';
import { inScope, isActive } from '../eligibility/rules.js';

export interface TournamentRef {
  readonly id: string;
  readonly seasonId: string | null;
  readonly circuitId: string | null;
}

export interface ExclusivityPolicy {
  readonly exclusivityScope: ExclusivityScope;
  /** Days a player waits after leaving a roster of the scope (roster rules). */
  readonly leaveCooldownDays?: number;
}

/**
 * The configured rules plus the exclusivity of the tournament. The scope is a
 * tournament setting, so a configured `exclusivity` rule is replaced by it.
 */
export function effectiveEligibilityRules(
  rules: readonly EligibilityRule[],
  policy: ExclusivityPolicy,
): EligibilityRule[] {
  const configured = rules.filter((rule) => rule.type !== 'exclusivity');
  if (policy.exclusivityScope === 'none') return configured;
  return [
    ...configured,
    {
      type: 'exclusivity',
      params: { scope: policy.exclusivityScope, cooldownDays: policy.leaveCooldownDays ?? 0 },
    },
  ];
}

/** `null` when nothing is locked: scope none, or a season/circuit scope the tournament lacks. */
export function exclusivityKey(scope: ExclusivityScope, tournament: TournamentRef): string | null {
  switch (scope) {
    case 'none':
      return null;
    case 'tournament':
      return `tournament:${tournament.id}`;
    case 'circuit':
      return tournament.circuitId === null ? null : `circuit:${tournament.circuitId}`;
    case 'season':
      return tournament.seasonId === null ? null : `season:${tournament.seasonId}`;
  }
}

/**
 * The key for a player's new roster row. The same team may play several
 * tournaments of one season or circuit: when the player already holds the
 * scope with that team, the new row stores no key (the first one holds it).
 */
export function rosterExclusivityKey(
  scope: ExclusivityScope,
  tournament: TournamentRef,
  teamId: string | null,
  rosters: readonly RosterMembership[],
  now: IsoDateTime,
): string | null {
  const key = exclusivityKey(scope, tournament);
  if (key === null || teamId === null) return key;
  const context: EligibilityContext = { now, tournament: { ...tournament, tier: 3 } };
  const heldBySameTeam = rosters.some(
    (r) => r.teamId === teamId && isActive(r, now) && inScope(r, scope, context),
  );
  return heldBySameTeam ? null : key;
}
