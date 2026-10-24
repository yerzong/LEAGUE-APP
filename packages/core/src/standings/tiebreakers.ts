// Tiebreakers as a Chain of Responsibility: each criterion scores the tied
// entrants and either splits them or hands the group to the next criterion.

import type { EntrantId, Match } from '../types.js';
import {
  isCounted,
  pointsFor,
  sideResults,
  type EntrantRecord,
  type PointsRule,
} from './points.js';

export type TiebreakCriterionKind =
  /** Points earned in matches among the tied entrants only. */
  | 'head_to_head'
  /** Game difference in matches among the tied entrants only. */
  | 'head_to_head_game_diff'
  | 'game_diff'
  | 'game_wins'
  | 'wins'
  /** Sum of the points of every opponent faced (Swiss). */
  | 'buchholz'
  /** Series won in matches flagged `isTiebreaker` among the tied entrants. */
  | 'tiebreaker_match';

/** Ordered list of criteria applied to entrants level on points. */
export type TiebreakRule = readonly TiebreakCriterionKind[];

export interface TiebreakContext {
  readonly records: ReadonlyMap<EntrantId, EntrantRecord>;
  readonly matches: readonly Match[];
  readonly pointsRule: PointsRule;
}

export interface TiebreakCriterion {
  readonly kind: TiebreakCriterionKind;
  /** Higher is better. `tied` is the group being separated. */
  score(entrantId: EntrantId, tied: ReadonlySet<EntrantId>, context: TiebreakContext): number;
}

/** Why an entrant ended where it did: a criterion that split its tied group. */
export interface TiebreakStep {
  readonly criterion: TiebreakCriterionKind;
  readonly value: number;
  readonly among: readonly EntrantId[];
}

export interface TieResolution {
  readonly entrantId: EntrantId;
  readonly steps: readonly TiebreakStep[];
  /** Entrants it remains level with after every criterion (manual tiebreaker). */
  readonly tiedWith: readonly EntrantId[];
}

const recordValue = (
  kind: TiebreakCriterionKind,
  field: 'gameDiff' | 'gameWins' | 'wins',
): TiebreakCriterion => ({
  kind,
  score: (id, _tied, { records }) => records.get(id)?.[field] ?? 0,
});

/** Sum over the counted matches between members of the tied group. */
function amongTied(
  kind: TiebreakCriterionKind,
  pick: (match: Match) => boolean,
  value: (side: ReturnType<typeof sideResults>[number], context: TiebreakContext) => number,
): TiebreakCriterion {
  return {
    kind,
    score: (id, tied, context) => {
      let total = 0;
      for (const match of context.matches) {
        if (!pick(match)) continue;
        for (const side of sideResults(match)) {
          if (side.entrantId === id && side.opponentId !== null && tied.has(side.opponentId)) {
            total += value(side, context);
          }
        }
      }
      return total;
    },
  };
}

export const TIEBREAK_CRITERIA: Readonly<Record<TiebreakCriterionKind, TiebreakCriterion>> = {
  head_to_head: amongTied('head_to_head', isCounted, (side, { pointsRule }) =>
    pointsFor(side, pointsRule),
  ),
  head_to_head_game_diff: amongTied(
    'head_to_head_game_diff',
    isCounted,
    (side) => side.gamesWon - side.gamesLost,
  ),
  game_diff: recordValue('game_diff', 'gameDiff'),
  game_wins: recordValue('game_wins', 'gameWins'),
  wins: recordValue('wins', 'wins'),
  buchholz: {
    kind: 'buchholz',
    score: (id, _tied, { matches, records }) => {
      let total = 0;
      for (const match of matches) {
        if (!isCounted(match)) continue;
        for (const side of sideResults(match)) {
          if (side.entrantId === id && side.opponentId !== null) {
            total += records.get(side.opponentId)?.points ?? 0;
          }
        }
      }
      return total;
    },
  },
  tiebreaker_match: amongTied(
    'tiebreaker_match',
    (match) => match.isTiebreaker === true,
    (side) => (side.outcome === 'win' ? 1 : 0),
  ),
};

/** One link of the chain: splits the group or cedes it to `next`. */
class TiebreakLink {
  constructor(
    private readonly criterion: TiebreakCriterion,
    private readonly next: TiebreakLink | null,
  ) {}

  resolve(
    group: readonly EntrantId[],
    context: TiebreakContext,
    head: TiebreakLink,
  ): TieResolution[] {
    const tied = new Set(group);
    const scored = group.map((id) => ({ id, value: this.criterion.score(id, tied, context) }));
    const values = [...new Set(scored.map((s) => s.value))].sort((x, y) => y - x);
    if (values.length === 1) {
      return this.next ? this.next.resolve(group, context, head) : unresolved(group);
    }
    return values.flatMap((value) => {
      const subgroup = scored.filter((s) => s.value === value).map((s) => s.id);
      const step: TiebreakStep = { criterion: this.criterion.kind, value, among: group };
      // The entrants still level start the chain again, among themselves only.
      const inner =
        subgroup.length === 1 ? single(subgroup) : head.resolve(subgroup, context, head);
      return inner.map((r) => ({ ...r, steps: [step, ...r.steps] }));
    });
  }
}

/**
 * Orders a group of entrants level on points. The result keeps every step that
 * separated each entrant, and `tiedWith` for those no criterion could split.
 */
export function resolveTie(
  group: readonly EntrantId[],
  rule: TiebreakRule,
  context: TiebreakContext,
): TieResolution[] {
  if (group.length < 2) {
    return single(group);
  }
  const head = rule.reduceRight<TiebreakLink | null>(
    (next, kind) => new TiebreakLink(TIEBREAK_CRITERIA[kind], next),
    null,
  );
  return head ? head.resolve(group, context, head) : unresolved(group);
}

function single(group: readonly EntrantId[]): TieResolution[] {
  return group.map((entrantId) => ({ entrantId, steps: [], tiedWith: [] }));
}

function unresolved(group: readonly EntrantId[]): TieResolution[] {
  return group.map((entrantId) => ({
    entrantId,
    steps: [],
    tiedWith: group.filter((other) => other !== entrantId),
  }));
}
