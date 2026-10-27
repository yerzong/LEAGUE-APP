// Registration (entrant) lifecycle: docs/03 §6.2 entrants.status.

import { createStateMachine } from '../lifecycle/state-machine.js';

export type EntrantStatus =
  'pending' | 'approved' | 'rejected' | 'waitlisted' | 'withdrawn' | 'disqualified';

export type EntrantEvent =
  | { readonly type: 'approve' }
  | { readonly type: 'reject' }
  | { readonly type: 'waitlist' }
  | { readonly type: 'promote' }
  | { readonly type: 'withdraw' }
  | { readonly type: 'disqualify' };

export interface EntrantContext {
  readonly approvedEntrants: number;
  /** `null` = no limit. */
  readonly capacity: number | null;
}

export const entrantLifecycle = createStateMachine<EntrantStatus, EntrantEvent, EntrantContext>(
  'entrant',
  {
    approve: {
      from: ['pending', 'waitlisted'],
      to: 'approved',
      guard: ({ approvedEntrants, capacity }) =>
        capacity === null || approvedEntrants < capacity ? null : 'tournament_full',
    },
    reject: { from: ['pending', 'waitlisted'], to: 'rejected' },
    waitlist: { from: ['pending'], to: 'waitlisted' },
    promote: { from: ['waitlisted'], to: 'pending' },
    withdraw: { from: ['pending', 'waitlisted', 'approved'], to: 'withdrawn' },
    disqualify: { from: ['approved'], to: 'disqualified' },
  },
);
