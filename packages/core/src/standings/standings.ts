import type { EntrantId, Match } from '../types.js';
import { buildRecords, type EntrantRecord, type PointsRule } from './points.js';
import { resolveTie, type TiebreakRule, type TiebreakStep } from './tiebreakers.js';

export interface Standing extends EntrantRecord {
  /** 1-based. Entrants in an unresolved tie share the rank. */
  readonly rank: number;
  readonly groupId: string | null;
  readonly tiebreaks: readonly TiebreakStep[];
  /** Non-empty when no criterion separated the entrant: needs a manual tiebreaker. */
  readonly tiedWith: readonly EntrantId[];
}

export interface TableInput {
  /** Every entrant of the table; order is the final fallback when a tie stays unresolved. */
  readonly entrants: readonly EntrantId[];
  readonly matches: readonly Match[];
  readonly pointsRule: PointsRule;
  readonly tiebreakRule: TiebreakRule;
  readonly groupId?: string | null;
}

/** Points first, then the tiebreak chain for each group of entrants level on points. */
export function computeTable({
  entrants,
  matches,
  pointsRule,
  tiebreakRule,
  groupId = null,
}: TableInput): Standing[] {
  const records = buildRecords(entrants, matches, pointsRule);
  const context = { records, matches, pointsRule };

  const byPoints = new Map<number, EntrantId[]>();
  for (const record of records.values()) {
    byPoints.set(record.points, [...(byPoints.get(record.points) ?? []), record.entrantId]);
  }

  const ordered = [...byPoints.entries()]
    .sort(([x], [y]) => y - x)
    .flatMap(([, group]) => resolveTie(group, tiebreakRule, context));

  const standings: Standing[] = [];
  for (const [index, resolution] of ordered.entries()) {
    const record = records.get(resolution.entrantId);
    if (!record) continue;
    const previous = standings.at(-1);
    const sharesRank = previous !== undefined && resolution.tiedWith.includes(previous.entrantId);
    standings.push({
      ...record,
      rank: sharesRank ? previous.rank : index + 1,
      groupId,
      tiebreaks: resolution.steps,
      tiedWith: resolution.tiedWith,
    });
  }
  return standings;
}

export function requiresManualTiebreak(standings: readonly Standing[]): boolean {
  return standings.some((s) => s.tiedWith.length > 0);
}
