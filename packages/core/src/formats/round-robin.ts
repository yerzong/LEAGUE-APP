import { computeTable } from '../standings/standings.js';
import type { Entrant, Match, SeriesFormat } from '../types.js';
import {
  assertSeriesFormat,
  blankMatch,
  entrantsOf,
  isTerminal,
  orderBySeed,
  recordCompletion,
  topAdvancement,
} from './shared.js';
import type { BaseFormatConfig, PhaseFormatStrategy } from './strategy.js';

export type RoundRobinConfig = BaseFormatConfig;

export interface RoundRobinSchedule {
  readonly seriesFormat: SeriesFormat;
  readonly legs: 1 | 2;
  readonly groupId?: string | null;
  /** Prefix for match ids, so several groups can share a phase. */
  readonly idPrefix?: string;
}

/**
 * Circle method: seed 1 stays fixed and the rest rotate. With an odd count a
 * phantom entrant is added and whoever faces it rests that round. The second
 * leg repeats the first with the slots swapped.
 */
export function scheduleRoundRobin(
  entrants: readonly Entrant[],
  schedule: RoundRobinSchedule,
): Match[] {
  const ids: (string | null)[] = orderBySeed(entrants, 2).map((e) => e.id);
  if (ids.length % 2 === 1) ids.push(null);
  const size = ids.length;
  const roundsPerLeg = size - 1;
  const [fixed = null, ...rotating] = ids;
  const prefix = schedule.idPrefix ?? '';

  const firstLeg: [string, string][][] = [];
  for (let r = 0; r < roundsPerLeg; r += 1) {
    const order = [
      fixed,
      ...rotating.slice(roundsPerLeg - r),
      ...rotating.slice(0, roundsPerLeg - r),
    ];
    const pairs: [string, string][] = [];
    for (let i = 0; i < size / 2; i += 1) {
      const home = order[i] ?? null;
      const away = order[size - 1 - i] ?? null;
      if (home === null || away === null) continue;
      // Alternate the fixed entrant's slot so it is not always "a".
      pairs.push(i === 0 && r % 2 === 1 ? [away, home] : [home, away]);
    }
    firstLeg.push(pairs);
  }

  const legs =
    schedule.legs === 2
      ? [...firstLeg, ...firstLeg.map((pairs) => pairs.map(([a, b]) => [b, a] as [string, string]))]
      : firstLeg;
  return legs.flatMap((pairs, r) =>
    pairs.map(([a, b], p) =>
      blankMatch({
        id: `${prefix}r${String(r + 1)}-m${String(p + 1)}`,
        round: r + 1,
        position: p + 1,
        seriesFormat: schedule.seriesFormat,
        groupId: schedule.groupId ?? null,
        entrantA: a,
        entrantB: b,
      }),
    ),
  );
}

function createRoundRobin(
  format: 'round_robin' | 'double_round_robin',
  legs: 1 | 2,
): PhaseFormatStrategy {
  return {
    format,
    generateMatches: (entrants, config) =>
      scheduleRoundRobin(entrants, { seriesFormat: assertSeriesFormat(config.seriesFormat), legs }),
    computeStandings: (matches, pointsRule, tiebreakRule) =>
      computeTable({ entrants: entrantsOf(matches), matches, pointsRule, tiebreakRule }),
    resolveAdvancement: (standings, advancement) => topAdvancement(standings, advancement.count),
    onMatchCompleted: (bracket, match) => recordCompletion(bracket, match, { allowDraw: true }),
    isComplete: (matches) => matches.every(isTerminal),
  };
}

export const roundRobin = createRoundRobin('round_robin', 1);
export const doubleRoundRobin = createRoundRobin('double_round_robin', 2);
