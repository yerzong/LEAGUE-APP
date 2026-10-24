// Helpers shared by the format strategies.

import {
  InvalidEntrantsError,
  InvalidFormatConfigError,
  InvalidMatchResultError,
  MatchNotFoundError,
} from '../errors.js';
import type { Standing } from '../standings/standings.js';
import type { Entrant, EntrantId, Match, MatchStatus, SeriesFormat } from '../types.js';
import type { AdvancementResult } from './strategy.js';

const SERIES_FORMATS: ReadonlySet<string> = new Set<SeriesFormat>(['bo1', 'bo3', 'bo5']);
const TERMINAL: ReadonlySet<MatchStatus> = new Set(['completed', 'forfeit', 'canceled']);
const FINISHED: ReadonlySet<MatchStatus> = new Set(['completed', 'forfeit']);

/** Validates the entrant list and returns it sorted by seed (1 first). */
export function orderBySeed(entrants: readonly Entrant[], minimum: number): Entrant[] {
  if (entrants.length < minimum) {
    throw new InvalidEntrantsError(`At least ${String(minimum)} entrants are required`, {
      reason: 'too_few',
      minimum,
      received: entrants.length,
    });
  }
  const ids = new Set(entrants.map((e) => e.id));
  if (ids.size !== entrants.length) {
    throw new InvalidEntrantsError('Entrant ids must be unique', { reason: 'duplicate_id' });
  }
  const seeds = new Set(entrants.map((e) => e.seed));
  if (seeds.size !== entrants.length) {
    throw new InvalidEntrantsError('Seeds must be unique', { reason: 'duplicate_seed' });
  }
  return [...entrants].sort((x, y) => x.seed - y.seed);
}

export function assertSeriesFormat(value: unknown, field = 'seriesFormat'): SeriesFormat {
  if (typeof value !== 'string' || !SERIES_FORMATS.has(value)) {
    throw new InvalidFormatConfigError(`${field} must be bo1, bo3 or bo5`, { field, value });
  }
  return value as SeriesFormat;
}

export function assertPositiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new InvalidFormatConfigError(`${field} must be a positive integer`, { field, value });
  }
  return value;
}

export function isTerminal(match: Match): boolean {
  return TERMINAL.has(match.status);
}

export function isFinished(match: Match): boolean {
  return FINISHED.has(match.status) && match.result !== null;
}

export function blankMatch(
  fields: Pick<Match, 'id' | 'round' | 'position' | 'seriesFormat'> & Partial<Match>,
): Match {
  return {
    groupId: null,
    bracketSide: null,
    entrantA: null,
    entrantB: null,
    sourceA: null,
    sourceB: null,
    nextWinner: null,
    nextLoser: null,
    status: 'pending',
    result: null,
    ...fields,
  };
}

/**
 * Validates that `match` is a finished version of a match in `bracket` and
 * returns the bracket with it replaced.
 */
export function recordCompletion(
  bracket: readonly Match[],
  match: Match,
  { allowDraw }: { allowDraw: boolean },
): Match[] {
  const index = bracket.findIndex((m) => m.id === match.id);
  const current = bracket[index];
  if (!current) {
    throw new MatchNotFoundError(`Match ${match.id} is not in the bracket`, { matchId: match.id });
  }
  const invalid = (reason: string) =>
    new InvalidMatchResultError(`Invalid result for match ${match.id}: ${reason}`, {
      matchId: match.id,
      reason,
    });

  if (!FINISHED.has(match.status) || match.result === null) {
    throw invalid('not_finished');
  }
  if (
    match.entrantA !== current.entrantA ||
    match.entrantB !== current.entrantB ||
    current.entrantA === null
  ) {
    throw invalid('entrants_mismatch');
  }
  const { winner, bye } = match.result;
  if (bye === true) {
    if (current.entrantB !== null || winner !== current.entrantA) throw invalid('invalid_bye');
  } else if (current.entrantB === null) {
    throw invalid('missing_opponent');
  } else if (
    winner === null ? !allowDraw : winner !== current.entrantA && winner !== current.entrantB
  ) {
    throw invalid(winner === null ? 'draw_not_allowed' : 'winner_not_participant');
  }
  return bracket.map((m, i) =>
    i === index ? { ...current, status: match.status, result: match.result } : m,
  );
}

/** Entrants in order of first appearance in the matches. */
export function entrantsOf(matches: readonly Match[]): EntrantId[] {
  const seen = new Set<EntrantId>();
  for (const m of matches) {
    if (m.entrantA !== null) seen.add(m.entrantA);
    if (m.entrantB !== null) seen.add(m.entrantB);
  }
  return [...seen];
}

/** Top `count` by rank; a tie straddling the cut line needs a tiebreaker. */
export function topAdvancement(standings: readonly Standing[], count: number): AdvancementResult {
  assertPositiveInteger(count, 'advancement.count');
  if (count > standings.length) {
    throw new InvalidFormatConfigError('advancement.count exceeds the number of entrants', {
      field: 'advancement.count',
      value: count,
      entrants: standings.length,
    });
  }
  const sorted = [...standings].sort((x, y) => x.rank - y.rank);
  const last = sorted[count - 1];
  const firstOut = sorted[count];
  const ids = (list: readonly Standing[]) => list.map((s) => s.entrantId);
  if (last && firstOut?.rank === last.rank) {
    const cutRank = last.rank;
    const tied = sorted.filter((s) => s.rank === cutRank);
    const advancing = sorted.filter((s) => s.rank < cutRank);
    return {
      status: 'requires_tiebreaker',
      advancing: ids(advancing),
      eliminated: ids(sorted.filter((s) => s.rank > cutRank)),
      tiedAtCutoff: ids(tied),
      openSlots: count - advancing.length,
    };
  }
  return {
    status: 'resolved',
    advancing: ids(sorted.slice(0, count)),
    eliminated: ids(sorted.slice(count)),
  };
}
