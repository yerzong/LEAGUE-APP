import { createStateMachine } from './state-machine.js';

export type TournamentStatus =
  | 'draft'
  | 'published'
  | 'registration_open'
  | 'registration_closed'
  | 'seeding'
  | 'in_progress'
  | 'completed'
  | 'canceled'
  | 'archived';

export type TournamentEvent =
  | { readonly type: 'publish' }
  | { readonly type: 'open_registration' }
  | { readonly type: 'close_registration' }
  | { readonly type: 'reopen_registration' }
  | { readonly type: 'start_seeding' }
  | { readonly type: 'start' }
  | { readonly type: 'complete' }
  | { readonly type: 'cancel' }
  | { readonly type: 'archive' };

export interface TournamentContext {
  readonly phaseCount: number;
  readonly approvedEntrants: number;
  readonly minEntrants: number;
  readonly allPhasesCompleted: boolean;
}

export const tournamentLifecycle = createStateMachine<
  TournamentStatus,
  TournamentEvent,
  TournamentContext
>('tournament', {
  publish: {
    from: ['draft'],
    to: 'published',
    guard: ({ phaseCount }) => (phaseCount > 0 ? null : 'no_phases'),
  },
  open_registration: { from: ['published'], to: 'registration_open' },
  close_registration: { from: ['registration_open'], to: 'registration_closed' },
  reopen_registration: { from: ['registration_closed'], to: 'registration_open' },
  start_seeding: {
    from: ['registration_closed'],
    to: 'seeding',
    guard: ({ approvedEntrants, minEntrants }) =>
      approvedEntrants >= minEntrants ? null : 'not_enough_entrants',
  },
  start: { from: ['seeding'], to: 'in_progress' },
  complete: {
    from: ['in_progress'],
    to: 'completed',
    guard: ({ allPhasesCompleted }) => (allPhasesCompleted ? null : 'phases_pending'),
  },
  cancel: {
    from: [
      'draft',
      'published',
      'registration_open',
      'registration_closed',
      'seeding',
      'in_progress',
    ],
    to: 'canceled',
  },
  archive: { from: ['completed', 'canceled'], to: 'archived' },
});
