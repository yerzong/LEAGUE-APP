// Test-only builders. Excluded from the build and from coverage.
import type { EntrantId, Match, MatchResult, SeriesFormat } from '../types.js';

let counter = 0;

export function pendingMatch(overrides: Partial<Match> = {}): Match {
  counter += 1;
  return {
    id: `m${String(counter)}`,
    round: 1,
    position: counter,
    groupId: null,
    bracketSide: null,
    entrantA: null,
    entrantB: null,
    sourceA: null,
    sourceB: null,
    nextWinner: null,
    nextLoser: null,
    seriesFormat: 'bo3',
    status: 'pending',
    result: null,
    ...overrides,
  };
}

/** A completed series. The winner is whoever has the higher score (equal = draw). */
export function played(
  a: EntrantId,
  b: EntrantId,
  scoreA: number,
  scoreB: number,
  overrides: Partial<Match> & { forfeit?: boolean; seriesFormat?: SeriesFormat } = {},
): Match {
  const { forfeit, ...rest } = overrides;
  const winner = scoreA === scoreB ? null : scoreA > scoreB ? a : b;
  const result: MatchResult = forfeit
    ? { scoreA, scoreB, winner, forfeit }
    : { scoreA, scoreB, winner };
  return pendingMatch({
    entrantA: a,
    entrantB: b,
    status: forfeit ? 'forfeit' : 'completed',
    result,
    ...rest,
  });
}

export function bye(entrant: EntrantId, overrides: Partial<Match> = {}): Match {
  return pendingMatch({
    entrantA: entrant,
    status: 'completed',
    result: { scoreA: 0, scoreB: 0, winner: entrant, bye: true },
    ...overrides,
  });
}
