// Specification pattern: small predicates that explain why they fail and compose.

export type FailureDetails = Readonly<Record<string, string | number>>;

export interface SpecificationFailure {
  /** Stable code; the UI maps it to an i18n message. */
  readonly reason: string;
  readonly details: FailureDetails;
}

export class Specification<T> {
  constructor(private readonly evaluate: (candidate: T) => readonly SpecificationFailure[]) {}

  /** Failures for `candidate`; empty when satisfied. */
  check(candidate: T): readonly SpecificationFailure[] {
    return this.evaluate(candidate);
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.check(candidate).length === 0;
  }

  /** Short-circuits like `&&`: `other` is only checked when this one passes. */
  and(other: Specification<T>): Specification<T> {
    return new Specification((c) => {
      const failures = this.check(c);
      return failures.length > 0 ? failures : other.check(c);
    });
  }

  /** Satisfied when either is; otherwise reports both (identical reasons once). */
  or(other: Specification<T>): Specification<T> {
    return new Specification((c) => {
      const left = this.check(c);
      if (left.length === 0) return left;
      const right = other.check(c);
      if (right.length === 0) return right;
      return [...left, ...right.filter((f) => !left.some((l) => l.reason === f.reason))];
    });
  }

  not(failure: SpecificationFailure): Specification<T> {
    return new Specification((c) => (this.isSatisfiedBy(c) ? [failure] : []));
  }
}

export function specification<T>(
  evaluate: (candidate: T) => readonly SpecificationFailure[],
): Specification<T> {
  return new Specification(evaluate);
}

/** A specification that fails with `reason` when `holds` is false. */
export function rule<T>(
  holds: (candidate: T) => boolean,
  reason: string,
  details: (candidate: T) => FailureDetails = () => ({}),
): Specification<T> {
  return new Specification((c) => (holds(c) ? [] : [{ reason, details: details(c) }]));
}
