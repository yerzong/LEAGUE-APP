import type { EntrantId, Match } from '../types.js';

export type PointsBonus =
  /** Added for every game won (also in lost series). */
  | { readonly kind: 'per_game_won'; readonly points: number }
  /** Added to the winner of a series that conceded no game. */
  | { readonly kind: 'clean_sweep'; readonly points: number }
  /** Added (usually negative) to the loser of a forfeited series. */
  | { readonly kind: 'forfeit_loss'; readonly points: number };

export interface PointsRule {
  readonly win: number;
  readonly loss: number;
  readonly draw: number;
  readonly bonus?: readonly PointsBonus[];
}

/** docs/02-formatos-competencia.md §4.4: 3 per series won, 0 per series lost. */
export const DEFAULT_POINTS_RULE: PointsRule = { win: 3, loss: 0, draw: 1 };

export interface EntrantRecord {
  readonly entrantId: EntrantId;
  readonly played: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly gameWins: number;
  readonly gameLosses: number;
  readonly gameDiff: number;
  readonly points: number;
}

/** A finished, counted series seen from one side. */
export interface SideResult {
  readonly entrantId: EntrantId;
  /** `null` for a bye. */
  readonly opponentId: EntrantId | null;
  readonly outcome: 'win' | 'loss' | 'draw';
  readonly gamesWon: number;
  readonly gamesLost: number;
  readonly forfeit: boolean;
}

const COUNTED_STATUSES: ReadonlySet<Match['status']> = new Set(['completed', 'forfeit']);

/** Matches that count for records: finished, with a result, not a tiebreaker. */
export function isCounted(match: Match): boolean {
  return COUNTED_STATUSES.has(match.status) && match.result !== null && match.isTiebreaker !== true;
}

/** Both sides of a finished match (one side for a bye); empty when unfinished. */
export function sideResults(match: Match): SideResult[] {
  const { result, entrantA, entrantB } = match;
  if (!COUNTED_STATUSES.has(match.status) || result === null || entrantA === null) {
    return [];
  }
  const forfeit = result.forfeit === true;
  if (result.bye === true || entrantB === null) {
    return [
      { entrantId: entrantA, opponentId: null, outcome: 'win', gamesWon: 0, gamesLost: 0, forfeit },
    ];
  }
  const outcomeOf = (id: EntrantId) =>
    result.winner === null ? 'draw' : result.winner === id ? 'win' : 'loss';
  return [
    {
      entrantId: entrantA,
      opponentId: entrantB,
      outcome: outcomeOf(entrantA),
      gamesWon: result.scoreA,
      gamesLost: result.scoreB,
      forfeit,
    },
    {
      entrantId: entrantB,
      opponentId: entrantA,
      outcome: outcomeOf(entrantB),
      gamesWon: result.scoreB,
      gamesLost: result.scoreA,
      forfeit,
    },
  ];
}

export function pointsFor(side: SideResult, rule: PointsRule): number {
  let points = side.outcome === 'win' ? rule.win : side.outcome === 'loss' ? rule.loss : rule.draw;
  for (const bonus of rule.bonus ?? []) {
    switch (bonus.kind) {
      case 'per_game_won':
        points += bonus.points * side.gamesWon;
        break;
      case 'clean_sweep':
        if (side.outcome === 'win' && side.opponentId !== null && side.gamesLost === 0) {
          points += bonus.points;
        }
        break;
      case 'forfeit_loss':
        if (side.outcome === 'loss' && side.forfeit) {
          points += bonus.points;
        }
        break;
    }
  }
  return points;
}

/** Aggregates the counted matches into one record per entrant, in `entrants` order. */
export function buildRecords(
  entrants: readonly EntrantId[],
  matches: readonly Match[],
  rule: PointsRule,
): Map<EntrantId, EntrantRecord> {
  const records = new Map<EntrantId, EntrantRecord>(entrants.map((id) => [id, emptyRecord(id)]));
  for (const match of matches) {
    if (!isCounted(match)) {
      continue;
    }
    for (const side of sideResults(match)) {
      const current = records.get(side.entrantId) ?? emptyRecord(side.entrantId);
      const gameWins = current.gameWins + side.gamesWon;
      const gameLosses = current.gameLosses + side.gamesLost;
      records.set(side.entrantId, {
        entrantId: side.entrantId,
        played: current.played + 1,
        wins: current.wins + (side.outcome === 'win' ? 1 : 0),
        losses: current.losses + (side.outcome === 'loss' ? 1 : 0),
        draws: current.draws + (side.outcome === 'draw' ? 1 : 0),
        gameWins,
        gameLosses,
        gameDiff: gameWins - gameLosses,
        points: current.points + pointsFor(side, rule),
      });
    }
  }
  return records;
}

function emptyRecord(entrantId: EntrantId): EntrantRecord {
  return {
    entrantId,
    played: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    gameWins: 0,
    gameLosses: 0,
    gameDiff: 0,
    points: 0,
  };
}
