// Preview of the phase structure for a number of entrants (wizard review
// step, docs/14 §3.1), using the format strategies themselves: an invalid
// configuration fails here with the same error as when fixtures are generated.

import { InvalidFormatConfigError } from '../errors.js';
import type { PhaseFormatRegistry } from '../formats/registry.js';
import type { Entrant } from '../types.js';

export interface PhasePlan {
  readonly format: string;
  /** The phase's format config (validated by its strategy). */
  readonly config: unknown;
  /** How many advance to the next phase (per group in `groups`); `null` for the last phase. */
  readonly advance: number | null;
}

export interface PhaseShape {
  readonly entrants: number;
  readonly rounds: number;
  readonly matches: number;
  /** Size of each group; empty for formats without groups. */
  readonly groups: readonly number[];
}

function plannedRounds(config: unknown): number | null {
  const rounds = (config as { rounds?: unknown } | null)?.rounds;
  return typeof rounds === 'number' ? rounds : null;
}

export function describeStructure(
  registry: PhaseFormatRegistry,
  phases: readonly PhasePlan[],
  entrantCount: number,
): PhaseShape[] {
  if (phases.length === 0) {
    throw new InvalidFormatConfigError('A tournament needs at least one phase', {
      field: 'phases',
    });
  }
  let entrants = entrantCount;
  return phases.map((phase, index) => {
    if (entrants < 2) {
      throw new InvalidFormatConfigError('A phase needs at least two entrants', {
        field: 'phases',
        phase: index,
        value: entrants,
      });
    }
    const seeds: Entrant[] = Array.from({ length: entrants }, (_, i) => ({
      id: `seed-${String(i + 1)}`,
      seed: i + 1,
    }));
    const matches = registry.get(phase.format).generateMatches(seeds, phase.config as never);

    const groupSizes = new Map<string, Set<string>>();
    for (const m of matches) {
      if (m.groupId === null) continue;
      const members = groupSizes.get(m.groupId) ?? new Set<string>();
      for (const id of [m.entrantA, m.entrantB]) if (id) members.add(id);
      groupSizes.set(m.groupId, members);
    }
    const groups = [...groupSizes.keys()].sort().map((id) => groupSizes.get(id)?.size ?? 0);

    // Formats paired round by round (Swiss) only generate the first round.
    const rounds = plannedRounds(phase.config);
    const shape: PhaseShape = rounds
      ? { entrants, rounds, matches: matches.length * rounds, groups }
      : {
          entrants,
          rounds: Math.max(0, ...matches.map((m) => m.round)),
          matches: matches.length,
          groups,
        };

    if (phase.advance !== null) {
      const pool = groups.length > 0 ? Math.min(...groups) : entrants;
      if (!Number.isInteger(phase.advance) || phase.advance < 1 || phase.advance > pool) {
        throw new InvalidFormatConfigError('Invalid number of advancing entrants', {
          field: 'advance',
          phase: index,
          value: phase.advance,
        });
      }
      entrants = phase.advance * Math.max(1, groups.length);
    }
    return shape;
  });
}
