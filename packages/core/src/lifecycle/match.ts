import type { EntrantId, MatchResult, MatchStatus } from '../types.js';
import { createStateMachine } from './state-machine.js';

export type MatchEvent =
  | { readonly type: 'schedule' }
  | { readonly type: 'open_checkin' }
  | { readonly type: 'checkin_complete' }
  | { readonly type: 'go_live' }
  | { readonly type: 'finish_games' }
  | { readonly type: 'confirm_result' }
  | { readonly type: 'dispute'; readonly at: string }
  | { readonly type: 'forfeit'; readonly entrantId: EntrantId }
  | { readonly type: 'cancel' };

export interface MatchContext {
  readonly entrantA: EntrantId | null;
  readonly entrantB: EntrantId | null;
  readonly checkedIn: readonly EntrantId[];
  readonly result: MatchResult | null;
  /** End of the dispute window after completion; `null` = no disputes once completed. */
  readonly disputeDeadline: string | null;
}

const entrantsKnown = ({ entrantA, entrantB }: MatchContext) =>
  entrantA !== null && entrantB !== null ? null : 'entrants_missing';

const bothCheckedIn = (ctx: MatchContext) =>
  entrantsKnown(ctx) ??
  ([ctx.entrantA, ctx.entrantB].every((id) => id !== null && ctx.checkedIn.includes(id))
    ? null
    : 'checkin_missing');

const hasWinner = ({ result, entrantA, entrantB }: MatchContext) => {
  const winner = result?.winner ?? null;
  return winner !== null && (winner === entrantA || winner === entrantB) ? null : 'winner_missing';
};

export const matchLifecycle = createStateMachine<MatchStatus, MatchEvent, MatchContext>('match', {
  schedule: { from: ['pending', 'scheduled', 'checkin'], to: 'scheduled', guard: entrantsKnown },
  open_checkin: { from: ['scheduled'], to: 'checkin', guard: entrantsKnown },
  checkin_complete: { from: ['checkin'], to: 'ready', guard: bothCheckedIn },
  go_live: { from: ['ready'], to: 'live', guard: bothCheckedIn },
  finish_games: { from: ['live'], to: 'awaiting_result' },
  confirm_result: { from: ['awaiting_result', 'disputed'], to: 'completed', guard: hasWinner },
  dispute: {
    from: ['awaiting_result', 'completed'],
    to: 'disputed',
    // Only the completed → disputed path is bounded by the window.
    guard: ({ disputeDeadline }, event, from) =>
      from === 'completed' &&
      (disputeDeadline === null || Date.parse(event.at) > Date.parse(disputeDeadline))
        ? 'dispute_window_closed'
        : null,
  },
  forfeit: {
    from: ['scheduled', 'checkin', 'ready', 'live', 'awaiting_result'],
    to: 'forfeit',
    guard: ({ entrantA, entrantB }, event) =>
      event.entrantId === entrantA || event.entrantId === entrantB ? null : 'entrant_not_in_match',
  },
  cancel: {
    from: ['pending', 'scheduled', 'checkin', 'ready', 'live', 'awaiting_result', 'disputed'],
    to: 'canceled',
  },
});
