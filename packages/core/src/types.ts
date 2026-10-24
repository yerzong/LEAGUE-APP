// Domain types for the competition engine. Aligned with docs/03-modelo-datos.md
// in concept, but independent from the database schema.

/** Stable key of an entrant (a registration: team, duo or solo player). */
export type EntrantId = string;

/** Riot numeric champion id (Match-V5 `championId`). */
export type ChampionId = number;

export type Side = 'blue' | 'red';

export type SeriesFormat = 'bo1' | 'bo3' | 'bo5';

export type DraftMode = 'standard' | 'fearless';

export interface Entrant {
  readonly id: EntrantId;
  /** 1 is the strongest seed. Entrants are ordered by seed when generating matches. */
  readonly seed: number;
}

export type MatchStatus =
  | 'pending'
  | 'scheduled'
  | 'checkin'
  | 'ready'
  | 'live'
  | 'awaiting_result'
  | 'disputed'
  | 'completed'
  | 'forfeit'
  | 'canceled';

export type GameStatus = 'pending' | 'lobby' | 'live' | 'completed' | 'remade' | 'forfeit';

export type BracketSide = 'upper' | 'lower' | 'final';

export type MatchSlot = 'a' | 'b';

/** Where a match slot gets its entrant from. */
export type SlotSource =
  | { readonly kind: 'seed'; readonly seed: number }
  | { readonly kind: 'match'; readonly matchId: string; readonly outcome: 'winner' | 'loser' };

export interface MatchLink {
  readonly matchId: string;
  readonly slot: MatchSlot;
}

export interface MatchResult {
  readonly scoreA: number;
  readonly scoreB: number;
  /** `null` is a draw (only reachable through an admin result). */
  readonly winner: EntrantId | null;
  readonly forfeit?: boolean;
  /** A Swiss bye: the entrant gets the win without playing. */
  readonly bye?: boolean;
}

/** A series between two entrants. `id` is unique within its phase. */
export interface Match {
  readonly id: string;
  readonly round: number;
  readonly position: number;
  readonly groupId: string | null;
  readonly bracketSide: BracketSide | null;
  readonly entrantA: EntrantId | null;
  readonly entrantB: EntrantId | null;
  readonly sourceA: SlotSource | null;
  readonly sourceB: SlotSource | null;
  readonly nextWinner: MatchLink | null;
  readonly nextLoser: MatchLink | null;
  readonly seriesFormat: SeriesFormat;
  readonly status: MatchStatus;
  readonly result: MatchResult | null;
  /** Played only to break a tie: excluded from records and points. */
  readonly isTiebreaker?: boolean;
}

export interface DraftPick {
  readonly entrantId: EntrantId;
  readonly championId: ChampionId;
}

export interface Game {
  readonly number: number;
  readonly status: GameStatus;
  readonly blue: EntrantId;
  readonly red: EntrantId;
  readonly winner: EntrantId | null;
  readonly picks?: readonly DraftPick[];
}
