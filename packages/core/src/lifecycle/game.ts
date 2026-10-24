import type { EntrantId, GameStatus } from '../types.js';
import { createStateMachine } from './state-machine.js';

export type GameEvent =
  | { readonly type: 'open_lobby' }
  | { readonly type: 'start' }
  | { readonly type: 'complete' }
  | { readonly type: 'remake' }
  | { readonly type: 'forfeit' };

export interface GameContext {
  readonly blue: EntrantId;
  readonly red: EntrantId;
  readonly winner: EntrantId | null;
}

const winnerIsASide = ({ blue, red, winner }: GameContext) =>
  winner !== null && (winner === blue || winner === red) ? null : 'winner_missing';

export const gameLifecycle = createStateMachine<GameStatus, GameEvent, GameContext>('game', {
  open_lobby: { from: ['pending'], to: 'lobby' },
  start: { from: ['lobby'], to: 'live' },
  complete: { from: ['live'], to: 'completed', guard: winnerIsASide },
  remake: { from: ['lobby', 'live'], to: 'remade' },
  forfeit: { from: ['pending', 'lobby', 'live'], to: 'forfeit', guard: winnerIsASide },
});
