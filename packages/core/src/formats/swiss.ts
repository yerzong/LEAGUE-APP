import { InvalidFormatConfigError, RoundInProgressError } from '../errors.js';
import { buildRecords, type EntrantRecord } from '../standings/points.js';
import { computeTable } from '../standings/standings.js';
import type { Entrant, EntrantId, Match, SeriesFormat } from '../types.js';
import {
  assertPositiveInteger,
  assertSeriesFormat,
  blankMatch,
  entrantsOf,
  isTerminal,
  orderBySeed,
  recordCompletion,
  topAdvancement,
} from './shared.js';
import type { BaseFormatConfig, PhaseFormatStrategy } from './strategy.js';

export interface SwissConfig extends BaseFormatConfig {
  readonly rounds: number;
  /** Entrants with this many wins stop playing (they are through). */
  readonly winsToAdvance?: number;
  /** Entrants with this many losses stop playing (they are out). */
  readonly lossesToEliminate?: number;
}

/** Pairing score: series won (a bye counts as a win), draws half. */
const PAIRING_POINTS = { win: 1, loss: 0, draw: 0.5 };

interface Settings {
  readonly seriesFormat: SeriesFormat;
  readonly rounds: number;
  readonly winsToAdvance: number;
  readonly lossesToEliminate: number;
}

function settings(config: SwissConfig, entrantCount: number): Settings {
  const seriesFormat = assertSeriesFormat(config.seriesFormat);
  const rounds = assertPositiveInteger(config.rounds, 'rounds');
  if (rounds > entrantCount) {
    throw new InvalidFormatConfigError('More Swiss rounds than entrants', {
      field: 'rounds',
      value: rounds,
      entrants: entrantCount,
    });
  }
  return {
    seriesFormat,
    rounds,
    winsToAdvance:
      config.winsToAdvance === undefined
        ? Number.POSITIVE_INFINITY
        : assertPositiveInteger(config.winsToAdvance, 'winsToAdvance'),
    lossesToEliminate:
      config.lossesToEliminate === undefined
        ? Number.POSITIVE_INFINITY
        : assertPositiveInteger(config.lossesToEliminate, 'lossesToEliminate'),
  };
}

const pairKey = (a: EntrantId, b: EntrantId) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Candidate opponents for `first`, best first: inside its score group the
 * "fold" opponent (top half meets bottom half), then the rest of the group,
 * then lower score groups in order.
 */
function candidates(
  first: EntrantId,
  rest: readonly EntrantId[],
  points: (id: EntrantId) => number,
): EntrantId[] {
  const group = rest.filter((id) => points(id) === points(first));
  const others = rest.filter((id) => points(id) !== points(first));
  const half = Math.floor((group.length + 1) / 2);
  const fold = Math.max(half - 1, 0);
  return [...group.slice(fold), ...group.slice(0, fold).reverse(), ...others];
}

/** Upper bound on backtracking steps before accepting a rematch. */
const PAIRING_BUDGET = 20_000;

/** Backtracking pairing that avoids rematches unless `allowRematch`. */
function pairUp(
  pool: readonly EntrantId[],
  played: ReadonlySet<string>,
  points: (id: EntrantId) => number,
  allowRematch: boolean,
  budget = { steps: PAIRING_BUDGET },
): [EntrantId, EntrantId][] | null {
  const [first, ...rest] = pool;
  if (first === undefined) return [];
  for (const opponent of candidates(first, rest, points)) {
    if (!allowRematch && played.has(pairKey(first, opponent))) continue;
    budget.steps -= 1;
    if (budget.steps < 0) return null;
    const tail = pairUp(
      rest.filter((id) => id !== opponent),
      played,
      points,
      allowRematch,
      budget,
    );
    if (tail) return [[first, opponent], ...tail];
  }
  return null;
}

function pairRound(
  ordered: readonly Entrant[],
  matches: readonly Match[],
  round: number,
  config: Settings,
): Match[] {
  const ids = ordered.map((e) => e.id);
  const records = buildRecords(ids, matches, PAIRING_POINTS);
  const record = (id: EntrantId) => records.get(id) as EntrantRecord;
  const seedOf = new Map(ordered.map((e, i) => [e.id, i]));

  const active = ids
    .filter(
      (id) =>
        record(id).wins < config.winsToAdvance && record(id).losses < config.lossesToEliminate,
    )
    .sort(
      (x, y) => record(y).points - record(x).points || (seedOf.get(x) ?? 0) - (seedOf.get(y) ?? 0),
    );

  const played = new Set<string>();
  const hadBye = new Set<EntrantId>();
  for (const m of matches) {
    if (m.entrantA !== null && m.entrantB !== null) played.add(pairKey(m.entrantA, m.entrantB));
    if (m.result?.bye === true && m.entrantA !== null) hadBye.add(m.entrantA);
  }

  const created: Match[] = [];
  let pool = active;
  if (pool.length % 2 === 1) {
    // Lowest-ranked entrant that has not had a bye yet.
    const byeTo = [...pool].reverse().find((id) => !hadBye.has(id)) ?? pool.at(-1);
    if (byeTo !== undefined) {
      pool = pool.filter((id) => id !== byeTo);
      created.push(
        blankMatch({
          id: `r${String(round)}-bye`,
          round,
          position: Math.ceil(active.length / 2),
          seriesFormat: config.seriesFormat,
          entrantA: byeTo,
          status: 'completed',
          result: { scoreA: 0, scoreB: 0, winner: byeTo, bye: true },
        }),
      );
    }
  }

  const points = (id: EntrantId) => record(id).points;
  const pairs = pairUp(pool, played, points, false) ?? pairUp(pool, played, points, true) ?? [];
  const games = pairs.map(([a, b], i) =>
    blankMatch({
      id: `r${String(round)}-m${String(i + 1)}`,
      round,
      position: i + 1,
      seriesFormat: config.seriesFormat,
      entrantA: a,
      entrantB: b,
    }),
  );
  return [...games, ...created];
}

const latestRound = (matches: readonly Match[]) => Math.max(0, ...matches.map((m) => m.round));

/**
 * Pairs the next Swiss round from the results so far. Returns `matches`
 * unchanged when every round has been played or nobody is left to pair.
 */
export function pairNextSwissRound(
  entrants: readonly Entrant[],
  matches: readonly Match[],
  config: SwissConfig,
): Match[] {
  const ordered = orderBySeed(entrants, 2);
  const resolved = settings(config, ordered.length);
  const round = latestRound(matches);
  if (!matches.filter((m) => m.round === round).every(isTerminal)) {
    throw new RoundInProgressError(`Round ${String(round)} is still being played`, { round });
  }
  if (round >= resolved.rounds) return [...matches];
  const next = pairRound(ordered, matches, round + 1, resolved);
  return next.length === 0 ? [...matches] : [...matches, ...next];
}

export const swiss: PhaseFormatStrategy<SwissConfig> = {
  format: 'swiss',

  generateMatches(entrants, config) {
    const ordered = orderBySeed(entrants, 2);
    return pairRound(ordered, [], 1, settings(config, ordered.length));
  },

  computeStandings: (matches, pointsRule, tiebreakRule) =>
    computeTable({ entrants: entrantsOf(matches), matches, pointsRule, tiebreakRule }),
  resolveAdvancement: (standings, advancement) => topAdvancement(standings, advancement.count),
  onMatchCompleted: (bracket, match) => recordCompletion(bracket, match, { allowDraw: true }),

  isComplete(matches, config) {
    const round = latestRound(matches);
    if (!matches.every(isTerminal)) return false;
    if (round >= config.rounds) return true;
    // Nobody left to pair (thresholds reached): the phase ended early.
    const ids = entrantsOf(matches);
    const entrants = ids.map((id, i) => ({ id, seed: i + 1 }));
    return pairNextSwissRound(entrants, matches, config).length === matches.length;
  },
};
