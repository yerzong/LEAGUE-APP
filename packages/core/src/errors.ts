// Typed domain errors. Callers branch on `code`; messages are for logs, never for UI.

export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(
    message: string,
    readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidEntrantsError extends DomainError {
  readonly code = 'invalid_entrants';
}

export class InvalidFormatConfigError extends DomainError {
  readonly code = 'invalid_format_config';
}

export class UnknownFormatError extends DomainError {
  readonly code = 'unknown_format';
}

export class InvalidSeriesError extends DomainError {
  readonly code = 'invalid_series';
}

export class MatchNotFoundError extends DomainError {
  readonly code = 'match_not_found';
}

export class InvalidMatchResultError extends DomainError {
  readonly code = 'invalid_match_result';
}

export class BracketConflictError extends DomainError {
  readonly code = 'bracket_conflict';
}

export class UnknownEligibilityRuleError extends DomainError {
  readonly code = 'unknown_eligibility_rule';
}

export class InvalidEligibilityRuleError extends DomainError {
  readonly code = 'invalid_eligibility_rule';
}

export class IneligibleEntrantError extends DomainError {
  readonly code = 'ineligible_entrant';
}

export class InvalidTransitionError extends DomainError {
  readonly code = 'invalid_transition';
}

export class TransitionGuardError extends DomainError {
  readonly code = 'transition_guard_failed';
}

export class RoundInProgressError extends DomainError {
  readonly code = 'round_in_progress';
}

/** A team membership rule was broken; `details.reason` says which. */
export class TeamRuleError extends DomainError {
  readonly code = 'team_rule_violation';
}

/** A registration roster breaks the tournament roster rules; `details.violations` lists them. */
export class RosterRuleError extends DomainError {
  readonly code = 'invalid_roster';
}

export class InvalidSeedingError extends DomainError {
  readonly code = 'invalid_seeding';
}

/** A tournament section cannot be edited in the current status (docs/14 §3.2). */
export class LockedSectionError extends DomainError {
  readonly code = 'section_locked';
}
