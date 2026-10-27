// Dual report (docs/13 §8): each captain reports the winner of every game;
// matching reports confirm the series, different ones open a dispute.

import { InvalidSeriesError } from '../errors.js';
import { resolveSeries, type SeriesOutcome } from '../series/series.js';
import type { EntrantId, SeriesFormat } from '../types.js';

export interface ReportedGame {
  readonly number: number;
  /** Slot of the winner in the match. */
  readonly winner: 'a' | 'b';
}

export interface ResultReport {
  /** Entrant that sent the report. */
  readonly entrantId: EntrantId;
  readonly games: readonly ReportedGame[];
}

/** Score of a reported series; throws `InvalidSeriesError` unless it is complete and coherent. */
export function scoreReport(
  format: SeriesFormat,
  entrantA: EntrantId,
  entrantB: EntrantId,
  games: readonly ReportedGame[],
): SeriesOutcome {
  const outcome = resolveSeries({
    format,
    entrantA,
    entrantB,
    games: games.map((g) => ({
      number: g.number,
      status: 'completed' as const,
      blue: entrantA,
      red: entrantB,
      winner: g.winner === 'a' ? entrantA : entrantB,
    })),
  });
  if (!outcome.isComplete) {
    throw new InvalidSeriesError('The reported series is not finished', {
      reason: 'series_incomplete',
    });
  }
  return outcome;
}

export type Reconciliation =
  | { readonly status: 'waiting' }
  | {
      readonly status: 'agreed';
      readonly outcome: SeriesOutcome;
      readonly games: readonly ReportedGame[];
    }
  | { readonly status: 'disputed'; readonly reason: 'winner_mismatch' | 'score_mismatch' };

/** Latest report of each side decides; reports must already be valid (`scoreReport`). */
export function reconcileReports(
  format: SeriesFormat,
  entrantA: EntrantId,
  entrantB: EntrantId,
  reports: readonly ResultReport[],
): Reconciliation {
  const latest = (id: EntrantId) => [...reports].reverse().find((r) => r.entrantId === id);
  const fromA = latest(entrantA);
  const fromB = latest(entrantB);
  if (!fromA || !fromB) return { status: 'waiting' };
  const a = scoreReport(format, entrantA, entrantB, fromA.games);
  const b = scoreReport(format, entrantA, entrantB, fromB.games);
  if (a.winner !== b.winner) return { status: 'disputed', reason: 'winner_mismatch' };
  if (a.scoreA !== b.scoreA || a.scoreB !== b.scoreB)
    return { status: 'disputed', reason: 'score_mismatch' };
  return { status: 'agreed', outcome: a, games: fromA.games };
}
