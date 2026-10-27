// Seeding of the approved entrants (docs/14 §3.1): manual, random or by the
// average rank of the roster.

import { InvalidSeedingError } from '../errors.js';
import { rankValue, type Rank } from '../eligibility/rank.js';
import type { EntrantId } from '../types.js';

export type SeedingMethod = 'manual' | 'random' | 'rank';

export interface SeedCandidate {
  readonly entrantId: EntrantId;
  /** `averageRankValue` of the roster. */
  readonly averageRank: number;
  readonly registeredAt: string;
}

export interface SeedingOptions {
  /** Seed per entrant; must be a permutation of 1..n. */
  readonly manual?: Readonly<Record<EntrantId, number>>;
  /** Uniform in [0, 1); injected so the domain stays deterministic in tests. */
  readonly random?: () => number;
}

export interface SeedAssignment {
  readonly entrantId: EntrantId;
  readonly seed: number;
}

/** Mean `rankValue` of the players (unranked players count as the lowest value). */
export function averageRankValue(ranks: readonly (Rank | null)[]): number {
  if (ranks.length === 0) return 0;
  return ranks.reduce((sum, r) => sum + rankValue(r), 0) / ranks.length;
}

const numbered = (ids: readonly EntrantId[]): SeedAssignment[] =>
  ids.map((entrantId, i) => ({ entrantId, seed: i + 1 }));

export function seedEntrants(
  method: SeedingMethod,
  candidates: readonly SeedCandidate[],
  options: SeedingOptions = {},
): SeedAssignment[] {
  switch (method) {
    case 'rank':
      return numbered(
        [...candidates]
          .sort(
            (a, b) =>
              b.averageRank - a.averageRank ||
              Date.parse(a.registeredAt) - Date.parse(b.registeredAt),
          )
          .map((c) => c.entrantId),
      );
    case 'random': {
      const { random } = options;
      if (!random) throw new InvalidSeedingError('Random seeding needs a random source', {});
      const ids = candidates.map((c) => c.entrantId);
      for (let i = ids.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [ids[i], ids[j]] = [ids[j] as EntrantId, ids[i] as EntrantId];
      }
      return numbered(ids);
    }
    case 'manual': {
      const manual = options.manual ?? {};
      const seeds = candidates.map((c) => manual[c.entrantId]);
      const expected = candidates.map((_, i) => i + 1);
      const sorted = [...seeds].sort((a, b) => (a ?? 0) - (b ?? 0));
      if (sorted.some((seed, i) => seed !== expected[i])) {
        throw new InvalidSeedingError('Manual seeds must be a permutation of 1..n', {
          entrants: candidates.length,
        });
      }
      return candidates
        .map((c) => ({ entrantId: c.entrantId, seed: manual[c.entrantId] as number }))
        .sort((a, b) => a.seed - b.seed);
    }
  }
}
