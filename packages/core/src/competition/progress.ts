// Where a phase stands: its table (computed by the format strategy), whether
// it is over, who advances and who is out. The API stores the result.

import type {
  AdvancementResult,
  BaseFormatConfig,
  PhaseFormatStrategy,
} from '../formats/strategy.js';
import type { PointsRule } from '../standings/points.js';
import type { Standing } from '../standings/standings.js';
import type { TiebreakRule } from '../standings/tiebreakers.js';
import type { Entrant, EntrantId, Match } from '../types.js';

export type PhaseEntrantStatus = 'active' | 'eliminated' | 'advanced';

export interface PhaseProgress {
  readonly complete: boolean;
  readonly standings: readonly Standing[];
  /** `null` while the phase is open, and for the last phase. */
  readonly advancement: AdvancementResult | null;
  readonly statuses: Readonly<Record<EntrantId, PhaseEntrantStatus>>;
  /** Winner of the last phase once it is complete. */
  readonly champion: EntrantId | null;
}

const ELIMINATION = new Set(['single_elimination', 'double_elimination']);
const FINISHED = new Set<Match['status']>(['completed', 'forfeit']);

const loserOf = (m: Match) => {
  const winner = m.result?.winner ?? null;
  if (winner === null || m.entrantB === null) return null;
  return winner === m.entrantA ? m.entrantB : m.entrantA;
};

/**
 * @param advanceCount entrants advancing to the next phase (per group in
 * `groups`), `null` for the last phase.
 */
export function phaseProgress(
  strategy: PhaseFormatStrategy,
  matches: readonly Match[],
  /** The phase's format config (read by its strategy). */
  config: unknown,
  pointsRule: PointsRule,
  tiebreakRule: TiebreakRule,
  advanceCount: number | null,
): PhaseProgress {
  const standings = strategy.computeStandings(matches, pointsRule, tiebreakRule);
  const complete = matches.length > 0 && strategy.isComplete(matches, config as never);
  const statuses: Record<EntrantId, PhaseEntrantStatus> = {};
  for (const s of standings) statuses[s.entrantId] = 'active';

  // In a bracket a loss with nowhere to go (no lower bracket) is the way out.
  if (ELIMINATION.has(strategy.format)) {
    for (const m of matches) {
      const loser = FINISHED.has(m.status) && m.nextLoser === null ? loserOf(m) : null;
      if (loser !== null) statuses[loser] = 'eliminated';
    }
  }

  let advancement: AdvancementResult | null = null;
  let champion: EntrantId | null = null;
  if (complete) {
    if (advanceCount === null) {
      champion = [...standings].sort((a, b) => a.rank - b.rank)[0]?.entrantId ?? null;
      for (const id of Object.keys(statuses))
        statuses[id] = id === champion ? 'advanced' : 'eliminated';
    } else {
      // Group formats advance the top `count` of every group (their strategy knows how).
      advancement = strategy.resolveAdvancement(standings, { count: advanceCount });
      for (const id of Object.keys(statuses)) statuses[id] = 'eliminated';
      for (const id of advancement.advancing) statuses[id] = 'advanced';
    }
  }
  return { complete, standings, advancement, statuses, champion };
}

/** Entrants of the next phase, seeded in the order they advanced. */
export function seedsFromAdvancement(advancement: AdvancementResult | null): Entrant[] {
  return (advancement?.advancing ?? []).map((id, i) => ({ id, seed: i + 1 }));
}
