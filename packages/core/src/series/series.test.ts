import { describe, expect, it } from 'vitest';

import { InvalidSeriesError } from '../errors.js';
import type { Game, SeriesFormat } from '../types.js';
import { maxGames, resolveSeries, winsNeeded } from './series.js';

const A = 'team-a';
const B = 'team-b';

function game(number: number, winner: string | null, status: Game['status'] = 'completed'): Game {
  return { number, status, blue: number % 2 === 1 ? A : B, red: number % 2 === 1 ? B : A, winner };
}

function thrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('expected an error');
}

function series(format: SeriesFormat, games: readonly Game[]) {
  return resolveSeries({ format, entrantA: A, entrantB: B, games });
}

describe('series format', () => {
  it.each([
    ['bo1', 1, 1],
    ['bo3', 2, 3],
    ['bo5', 3, 5],
  ] as const)('%s needs %i wins over at most %i games', (format, wins, games) => {
    expect(winsNeeded(format)).toBe(wins);
    expect(maxGames(format)).toBe(games);
  });
});

describe('resolveSeries', () => {
  it('finishes a Bo1 with a single game', () => {
    expect(series('bo1', [game(1, B)])).toEqual({
      scoreA: 0,
      scoreB: 1,
      isComplete: true,
      winner: B,
    });
  });

  it('keeps a Bo3 open at 1-1 and closes it at 2-1', () => {
    expect(series('bo3', [game(1, A), game(2, B)])).toMatchObject({
      scoreA: 1,
      scoreB: 1,
      isComplete: false,
      winner: null,
    });
    expect(series('bo3', [game(1, A), game(2, B), game(3, A)])).toMatchObject({
      scoreA: 2,
      scoreB: 1,
      isComplete: true,
      winner: A,
    });
  });

  it('closes a Bo5 at 3-0 and at 3-2', () => {
    expect(series('bo5', [game(1, B), game(2, B), game(3, B)])).toMatchObject({
      scoreB: 3,
      winner: B,
    });
    const reverse = [game(1, A), game(2, A), game(3, B), game(4, B), game(5, B)];
    expect(series('bo5', reverse)).toMatchObject({ scoreA: 2, scoreB: 3, winner: B });
  });

  it('counts forfeits, ignores remakes and unfinished games, in game order', () => {
    const games = [game(3, A), game(1, A, 'remade'), game(2, B, 'forfeit'), game(4, null, 'live')];
    expect(series('bo5', games)).toMatchObject({ scoreA: 1, scoreB: 1, isComplete: false });
  });

  it('accepts a remade game replayed under the next number', () => {
    expect(series('bo1', [game(1, null, 'remade'), game(2, A)])).toMatchObject({ winner: A });
  });

  it('is empty before any game is played', () => {
    expect(series('bo3', [])).toEqual({ scoreA: 0, scoreB: 0, isComplete: false, winner: null });
  });

  describe('rejects incoherent series', () => {
    it.each<[string, SeriesFormat, Game[], string]>([
      [
        'a game after the series was decided',
        'bo3',
        [game(1, A), game(2, A), game(3, B)],
        'game_after_decision',
      ],
      ['a Bo1 with two games', 'bo1', [game(1, A), game(2, B)], 'game_after_decision'],
      ['a winner who is not in the series', 'bo3', [game(1, 'team-x')], 'winner_not_participant'],
      ['a finished game without winner', 'bo3', [game(1, null)], 'missing_winner'],
      ['repeated game numbers', 'bo3', [game(1, A), game(1, B)], 'duplicate_game_number'],
      ['a non-positive game number', 'bo3', [game(0, A)], 'invalid_game_number'],
    ])('%s', (_label, format, games, reason) => {
      expect(thrown(() => series(format, games))).toMatchObject({
        code: 'invalid_series',
        details: { reason },
      });
    });

    it('a game whose sides are not the two entrants', () => {
      const wrongSides: Game = { number: 1, status: 'completed', blue: A, red: A, winner: A };
      expect(() => series('bo1', [wrongSides])).toThrow(InvalidSeriesError);
    });

    it('a series against itself', () => {
      expect(() => resolveSeries({ format: 'bo1', entrantA: A, entrantB: A, games: [] })).toThrow(
        InvalidSeriesError,
      );
    });
  });
});
