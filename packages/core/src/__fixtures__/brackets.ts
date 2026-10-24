// Test-only: plays a bracket to the end with a deterministic winner rule.
import type { PhaseFormatStrategy } from '../formats/strategy.js';
import type { EntrantId, Match } from '../types.js';

export type WinnerRule = (a: EntrantId, b: EntrantId) => EntrantId;

/** Lower seed number wins (ids are `E<seed>`). */
export const favouriteWins: WinnerRule = (a, b) =>
  Number(a.slice(1)) < Number(b.slice(1)) ? a : b;

export const underdogWins: WinnerRule = (a, b) => (favouriteWins(a, b) === a ? b : a);

export function isReady(match: Match): boolean {
  return match.status === 'pending' && match.entrantA !== null && match.entrantB !== null;
}

export function finish(match: Match, winner: EntrantId, scores: [number, number] = [2, 1]): Match {
  const aWins = winner === match.entrantA;
  return {
    ...match,
    status: 'completed',
    result: {
      scoreA: aWins ? scores[0] : scores[1],
      scoreB: aWins ? scores[1] : scores[0],
      winner,
    },
  };
}

export function playOut(
  strategy: PhaseFormatStrategy<never>,
  bracket: readonly Match[],
  rule: WinnerRule = favouriteWins,
  limit = 200,
): Match[] {
  let current = [...bracket];
  for (let step = 0; step < limit; step += 1) {
    const next = current.find(isReady);
    if (!next || next.entrantA === null || next.entrantB === null) return current;
    current = strategy.onMatchCompleted(current, finish(next, rule(next.entrantA, next.entrantB)));
  }
  throw new Error('bracket did not finish');
}
