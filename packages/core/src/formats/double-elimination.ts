import { BracketConflictError } from '../errors.js';
import type { Match, SeriesFormat } from '../types.js';
import {
  advance,
  bracketOrder,
  buildBracket,
  nextPowerOfTwo,
  placementStandings,
  type MatchTemplate,
} from './bracket.js';
import {
  assertSeriesFormat,
  isTerminal,
  orderBySeed,
  recordCompletion,
  topAdvancement,
} from './shared.js';
import type { BaseFormatConfig, PhaseFormatStrategy } from './strategy.js';

export interface DoubleEliminationConfig extends BaseFormatConfig {
  /** Series format of the grand final (defaults to `seriesFormat`). */
  readonly finalSeriesFormat?: SeriesFormat;
  /** Play a second grand final when the lower bracket finalist wins the first. */
  readonly grandFinalReset?: boolean;
}

export const GRAND_FINAL_ID = 'gf-1';
export const GRAND_FINAL_RESET_ID = 'gf-2';

const upper = (round: number, position: number) => `u-r${String(round)}-m${String(position)}`;
const lower = (round: number, position: number) => `l-r${String(round)}-m${String(position)}`;
const winnerOf = (matchId: string) => ({
  kind: 'match' as const,
  matchId,
  outcome: 'winner' as const,
});
const loserOf = (matchId: string) => ({
  kind: 'match' as const,
  matchId,
  outcome: 'loser' as const,
});

/**
 * Upper bracket as in single elimination. The lower bracket alternates
 * "minor" rounds (lower survivors play each other) and "drop" rounds (they
 * meet the losers of the next upper round, in reverse order to delay
 * rematches). Its winner meets the upper winner in the grand final.
 */
function templates(
  size: number,
  seriesFormat: SeriesFormat,
  finalFormat: SeriesFormat,
  reset: boolean,
) {
  const rounds = Math.log2(size);
  const order = bracketOrder(size);
  const list: MatchTemplate[] = [];
  const push = (t: Omit<MatchTemplate, 'seriesFormat'>, format = seriesFormat) =>
    list.push({ ...t, seriesFormat: format });

  for (let round = 1; round <= rounds; round += 1) {
    for (let p = 1; p <= size / 2 ** round; p += 1) {
      push({
        id: upper(round, p),
        round,
        position: p,
        bracketSide: 'upper',
        a:
          round === 1
            ? { kind: 'seed', seed: order[p * 2 - 2] ?? 0 }
            : winnerOf(upper(round - 1, p * 2 - 1)),
        b:
          round === 1
            ? { kind: 'seed', seed: order[p * 2 - 1] ?? 0 }
            : winnerOf(upper(round - 1, p * 2)),
      });
    }
  }

  for (let p = 1; p <= size / 4; p += 1) {
    push({
      id: lower(1, p),
      round: 1,
      position: p,
      bracketSide: 'lower',
      a: loserOf(upper(1, p * 2 - 1)),
      b: loserOf(upper(1, p * 2)),
    });
  }
  for (let j = 1; j < rounds; j += 1) {
    const dropRound = 2 * j;
    const count = size / 2 ** (j + 1);
    for (let p = 1; p <= count; p += 1) {
      push({
        id: lower(dropRound, p),
        round: dropRound,
        position: p,
        bracketSide: 'lower',
        a: winnerOf(lower(dropRound - 1, p)),
        b: loserOf(upper(j + 1, count + 1 - p)),
      });
    }
    if (j < rounds - 1) {
      for (let p = 1; p <= count / 2; p += 1) {
        push({
          id: lower(dropRound + 1, p),
          round: dropRound + 1,
          position: p,
          bracketSide: 'lower',
          a: winnerOf(lower(dropRound, p * 2 - 1)),
          b: winnerOf(lower(dropRound, p * 2)),
        });
      }
    }
  }

  const lowerFinal = lower(2 * (rounds - 1), 1);
  push(
    {
      id: GRAND_FINAL_ID,
      round: 1,
      position: 1,
      bracketSide: 'final',
      a: winnerOf(upper(rounds, 1)),
      b: winnerOf(lowerFinal),
    },
    finalFormat,
  );
  if (reset) {
    push(
      {
        id: GRAND_FINAL_RESET_ID,
        round: 2,
        position: 1,
        bracketSide: 'final',
        a: winnerOf(GRAND_FINAL_ID),
        b: loserOf(GRAND_FINAL_ID),
      },
      finalFormat,
    );
  }
  return list;
}

/**
 * Placement weights: an upper round weighs just under the lower round its
 * losers drop into, so entrants are ranked by the lower round they fell in.
 */
function weight(matches: readonly Match[]) {
  const upperRounds = Math.max(
    ...matches.filter((m) => m.bracketSide === 'upper').map((m) => m.round),
  );
  const lowerRounds = 2 * (upperRounds - 1);
  return (m: Match) => {
    if (m.bracketSide === 'lower') return m.round;
    if (m.bracketSide === 'final') return lowerRounds + m.round;
    return m.round === 1 ? 0.5 : 2 * (m.round - 1) - 0.5;
  };
}

const RESET_EDITABLE: ReadonlySet<Match['status']> = new Set(['pending', 'scheduled', 'canceled']);

export const doubleElimination: PhaseFormatStrategy<DoubleEliminationConfig> = {
  format: 'double_elimination',

  generateMatches(entrants, config) {
    const seriesFormat = assertSeriesFormat(config.seriesFormat);
    const finalFormat = assertSeriesFormat(
      config.finalSeriesFormat ?? seriesFormat,
      'finalSeriesFormat',
    );
    const ordered = orderBySeed(entrants, 3);
    const size = nextPowerOfTwo(ordered.length);
    const seeds = new Map(ordered.map((e, i) => [i + 1, e.id]));
    return buildBracket(
      templates(size, seriesFormat, finalFormat, config.grandFinalReset === true),
      seeds,
    );
  },

  computeStandings: (matches, pointsRule) =>
    placementStandings(matches, pointsRule, weight(matches)),
  resolveAdvancement: (standings, advancement) => topAdvancement(standings, advancement.count),

  onMatchCompleted(bracket, match) {
    const reset = bracket.find((m) => m.id === GRAND_FINAL_RESET_ID);
    if (match.id !== GRAND_FINAL_ID || !reset) {
      return advance(bracket, match);
    }
    if (!RESET_EDITABLE.has(reset.status)) {
      throw new BracketConflictError('The grand final reset already started', {
        matchId: reset.id,
      });
    }
    const recorded = recordCompletion(bracket, match, { allowDraw: false });
    const upperFinalistWon = match.result?.winner === match.entrantA;
    if (upperFinalistWon) {
      // The upper finalist has not lost yet: the title is decided, no reset.
      return recorded.map((m) =>
        m.id === reset.id ? { ...m, status: 'canceled', entrantA: null, entrantB: null } : m,
      );
    }
    const reopened = bracket.map((m) =>
      m.id === reset.id ? { ...m, status: 'pending' as const } : m,
    );
    return advance(reopened, match);
  },

  isComplete: (matches) => matches.every(isTerminal),
};
