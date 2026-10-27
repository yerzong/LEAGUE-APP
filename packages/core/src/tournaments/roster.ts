// Roster of a registration against the tournament roster rules (docs/03 §6.1
// tournament_roster_rules, docs/13 §6). Pure: the caller loads the team.

import { RosterRuleError } from '../errors.js';
import { isPlayingRole, type TeamRole } from '../teams/teams.js';

export type RosterRole = 'starter' | 'substitute' | 'coach';

export interface RosterRules {
  readonly starters: number;
  readonly maxSubstitutes: number;
  readonly coachAllowed: boolean;
}

export interface RosterEntry {
  readonly userId: string;
  readonly role: RosterRole;
}

export interface RosterViolation {
  readonly reason: string;
  readonly details: Readonly<Record<string, unknown>>;
}

const MAX_COACHES = 1;

/**
 * Every violation, in a stable order. `teamMembers` is `null` for solo
 * entrants (no team to belong to).
 */
export function validateRoster(
  rules: RosterRules,
  roster: readonly RosterEntry[],
  teamMembers: readonly { readonly userId: string; readonly role: TeamRole }[] | null,
): RosterViolation[] {
  const violations: RosterViolation[] = [];
  const count = (role: RosterRole) => roster.filter((e) => e.role === role).length;

  const ids = roster.map((e) => e.userId);
  const duplicated = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  for (const userId of duplicated)
    violations.push({ reason: 'duplicate_player', details: { userId } });

  const starters = count('starter');
  if (starters !== rules.starters) {
    violations.push({
      reason: 'starters_count',
      details: { expected: rules.starters, actual: starters },
    });
  }
  const substitutes = count('substitute');
  if (substitutes > rules.maxSubstitutes) {
    violations.push({
      reason: 'too_many_substitutes',
      details: { max: rules.maxSubstitutes, actual: substitutes },
    });
  }
  const coaches = count('coach');
  if (coaches > 0 && !rules.coachAllowed) {
    violations.push({ reason: 'coach_not_allowed', details: {} });
  } else if (coaches > MAX_COACHES) {
    violations.push({ reason: 'too_many_coaches', details: { max: MAX_COACHES, actual: coaches } });
  }

  if (teamMembers !== null) {
    for (const entry of roster) {
      const member = teamMembers.find((m) => m.userId === entry.userId);
      if (!member) {
        violations.push({ reason: 'not_a_team_member', details: { userId: entry.userId } });
      } else if (entry.role !== 'coach' && !isPlayingRole(member.role)) {
        violations.push({ reason: 'not_a_playing_member', details: { userId: entry.userId } });
      }
    }
  }
  return violations;
}

export function assertValidRoster(
  rules: RosterRules,
  roster: readonly RosterEntry[],
  teamMembers: readonly { readonly userId: string; readonly role: TeamRole }[] | null,
): void {
  const violations = validateRoster(rules, roster, teamMembers);
  if (violations.length > 0) {
    throw new RosterRuleError('The roster breaks the tournament roster rules', { violations });
  }
}
