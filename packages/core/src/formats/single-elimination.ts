import type { Match, SeriesFormat } from '../types.js';
import {
  advance,
  bracketOrder,
  buildBracket,
  nextPowerOfTwo,
  placementStandings,
  type MatchTemplate,
} from './bracket.js';
import { assertSeriesFormat, isTerminal, orderBySeed, topAdvancement } from './shared.js';
import type { BaseFormatConfig, PhaseFormatStrategy } from './strategy.js';

export interface SingleEliminationConfig extends BaseFormatConfig {
  /** Series format of the final (defaults to `seriesFormat`). */
  readonly finalSeriesFormat?: SeriesFormat;
  readonly thirdPlaceMatch?: boolean;
}

export const THIRD_PLACE_MATCH_ID = 'third-place';

const matchId = (round: number, position: number) => `r${String(round)}-m${String(position)}`;

export function singleEliminationTemplates(
  size: number,
  seriesFormat: SeriesFormat,
  finalSeriesFormat: SeriesFormat,
  thirdPlaceMatch: boolean,
): MatchTemplate[] {
  const rounds = Math.log2(size);
  const order = bracketOrder(size);
  const templates: MatchTemplate[] = [];
  for (let round = 1; round <= rounds; round += 1) {
    const count = size / 2 ** round;
    for (let position = 1; position <= count; position += 1) {
      const fromPrevious = (offset: number) => ({
        kind: 'match' as const,
        matchId: matchId(round - 1, position * 2 - offset),
        outcome: 'winner' as const,
      });
      templates.push({
        id: matchId(round, position),
        round,
        position,
        bracketSide: null,
        seriesFormat: round === rounds ? finalSeriesFormat : seriesFormat,
        a: round === 1 ? { kind: 'seed', seed: order[position * 2 - 2] ?? 0 } : fromPrevious(1),
        b: round === 1 ? { kind: 'seed', seed: order[position * 2 - 1] ?? 0 } : fromPrevious(0),
      });
    }
  }
  if (thirdPlaceMatch && rounds >= 2) {
    templates.push({
      id: THIRD_PLACE_MATCH_ID,
      round: rounds,
      position: 2,
      bracketSide: null,
      seriesFormat,
      a: { kind: 'match', matchId: matchId(rounds - 1, 1), outcome: 'loser' },
      b: { kind: 'match', matchId: matchId(rounds - 1, 2), outcome: 'loser' },
    });
  }
  return templates;
}

/** Final round weighs most; the third place match sits between semifinals and final. */
function weight(matches: readonly Match[]) {
  const finalRound = Math.max(...matches.map((m) => m.round));
  return (m: Match) => (m.id === THIRD_PLACE_MATCH_ID ? finalRound - 0.5 : m.round);
}

export const singleElimination: PhaseFormatStrategy<SingleEliminationConfig> = {
  format: 'single_elimination',

  generateMatches(entrants, config) {
    const seriesFormat = assertSeriesFormat(config.seriesFormat);
    const finalSeriesFormat = assertSeriesFormat(
      config.finalSeriesFormat ?? seriesFormat,
      'finalSeriesFormat',
    );
    const ordered = orderBySeed(entrants, 2);
    const size = nextPowerOfTwo(ordered.length);
    // Bracket positions use seed rank (1..n), so gaps in the input seeds don't create byes.
    const seeds = new Map(ordered.map((e, i) => [i + 1, e.id]));
    return buildBracket(
      singleEliminationTemplates(
        size,
        seriesFormat,
        finalSeriesFormat,
        config.thirdPlaceMatch === true,
      ),
      seeds,
    );
  },

  computeStandings: (matches, pointsRule) =>
    placementStandings(matches, pointsRule, weight(matches)),
  resolveAdvancement: (standings, advancement) => topAdvancement(standings, advancement.count),
  onMatchCompleted: advance,
  isComplete: (matches) => matches.every(isTerminal),
};
