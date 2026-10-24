import { InvalidSeriesError } from '../errors.js';
import type { EntrantId, Game, GameStatus, SeriesFormat } from '../types.js';

const BEST_OF: Readonly<Record<SeriesFormat, number>> = { bo1: 1, bo3: 3, bo5: 5 };

/** Statuses whose winner counts towards the series score. */
const COUNTED: ReadonlySet<GameStatus> = new Set(['completed', 'forfeit']);

export function maxGames(format: SeriesFormat): number {
  return BEST_OF[format];
}

export function winsNeeded(format: SeriesFormat): number {
  return Math.ceil(BEST_OF[format] / 2);
}

export interface SeriesInput {
  readonly format: SeriesFormat;
  readonly entrantA: EntrantId;
  readonly entrantB: EntrantId;
  readonly games: readonly Game[];
}

export interface SeriesOutcome {
  readonly scoreA: number;
  readonly scoreB: number;
  readonly isComplete: boolean;
  readonly winner: EntrantId | null;
}

/**
 * Scores a Bo1/Bo3/Bo5 from its games. Remade and unfinished games are ignored
 * (a remake is replayed under the next game number, so numbers can exceed the
 * format's game count). Any incoherence (a game after the series was decided,
 * an outsider as winner…) throws `InvalidSeriesError` with a `reason`.
 */
export function resolveSeries({ format, entrantA, entrantB, games }: SeriesInput): SeriesOutcome {
  if (entrantA === entrantB) {
    fail('same_entrant', { entrantA });
  }
  const target = winsNeeded(format);
  const seen = new Set<number>();
  const participants = new Set([entrantA, entrantB]);

  let scoreA = 0;
  let scoreB = 0;
  for (const game of [...games].sort((x, y) => x.number - y.number)) {
    if (!Number.isInteger(game.number) || game.number < 1) {
      fail('invalid_game_number', { game: game.number });
    }
    if (seen.has(game.number)) {
      fail('duplicate_game_number', { game: game.number });
    }
    seen.add(game.number);
    if (game.blue === game.red || !participants.has(game.blue) || !participants.has(game.red)) {
      fail('invalid_sides', { game: game.number });
    }
    if (!COUNTED.has(game.status)) {
      continue;
    }
    if (game.winner === null) {
      fail('missing_winner', { game: game.number });
    }
    if (!participants.has(game.winner)) {
      fail('winner_not_participant', { game: game.number, winner: game.winner });
    }
    if (scoreA === target || scoreB === target) {
      fail('game_after_decision', { game: game.number });
    }
    if (game.winner === entrantA) {
      scoreA += 1;
    } else {
      scoreB += 1;
    }
  }

  const winner = scoreA === target ? entrantA : scoreB === target ? entrantB : null;
  return { scoreA, scoreB, isComplete: winner !== null, winner };
}

function fail(reason: string, details: Record<string, unknown>): never {
  throw new InvalidSeriesError(`Invalid series: ${reason}`, { reason, ...details });
}
