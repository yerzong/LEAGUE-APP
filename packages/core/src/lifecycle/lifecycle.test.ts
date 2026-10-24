import { describe, expect, it } from 'vitest';

import { InvalidTransitionError, TransitionGuardError } from '../errors.js';
import { gameLifecycle, type GameContext } from './game.js';
import { matchLifecycle, type MatchContext } from './match.js';
import { createStateMachine } from './state-machine.js';
import { tournamentLifecycle, type TournamentContext } from './tournament.js';

function thrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('expected an error');
}

describe('state machine', () => {
  const door = createStateMachine<
    'open' | 'closed',
    { type: 'open' } | { type: 'close' },
    { locked: boolean }
  >('door', {
    open: { from: ['closed'], to: 'open', guard: ({ locked }) => (locked ? 'locked' : null) },
    close: { from: ['open'], to: 'closed' },
  });

  it('moves between states and lists the events available', () => {
    expect(door.transition('closed', { type: 'open' }, { locked: false })).toBe('open');
    expect(door.availableEvents('open')).toEqual(['close']);
    expect(door.can('open', { type: 'close' }, { locked: true })).toBe(true);
    expect(door.can('open', { type: 'open' }, { locked: false })).toBe(false);
    expect(door.can('closed', { type: 'open' }, { locked: true })).toBe(false);
  });

  it('fails with typed errors for invalid transitions and rejected guards', () => {
    expect(
      thrown(() => door.transition('open', { type: 'open' }, { locked: false })),
    ).toMatchObject({
      code: 'invalid_transition',
      details: { machine: 'door', from: 'open', event: 'open' },
    });
    const guard = thrown(() => door.transition('closed', { type: 'open' }, { locked: true }));
    expect(guard).toBeInstanceOf(TransitionGuardError);
    expect(guard).toMatchObject({ details: { reason: 'locked' } });
  });
});

describe('tournament lifecycle', () => {
  const ready: TournamentContext = {
    phaseCount: 2,
    approvedEntrants: 8,
    minEntrants: 4,
    allPhasesCompleted: false,
  };

  it('walks the happy path from draft to archived', () => {
    const path = [
      ['draft', 'publish', 'published'],
      ['published', 'open_registration', 'registration_open'],
      ['registration_open', 'close_registration', 'registration_closed'],
      ['registration_closed', 'reopen_registration', 'registration_open'],
      ['registration_closed', 'start_seeding', 'seeding'],
      ['seeding', 'start', 'in_progress'],
    ] as const;
    for (const [from, type, to] of path) {
      expect(tournamentLifecycle.transition(from, { type }, ready)).toBe(to);
    }
    const done = { ...ready, allPhasesCompleted: true };
    expect(tournamentLifecycle.transition('in_progress', { type: 'complete' }, done)).toBe(
      'completed',
    );
    expect(tournamentLifecycle.transition('completed', { type: 'archive' }, done)).toBe('archived');
  });

  it.each([
    ['draft', 'publish', { phaseCount: 0 }, 'no_phases'],
    ['registration_closed', 'start_seeding', { approvedEntrants: 3 }, 'not_enough_entrants'],
    ['in_progress', 'complete', { allPhasesCompleted: false }, 'phases_pending'],
  ] as const)('guards %s → %s', (from, type, override, reason) => {
    expect(
      thrown(() => tournamentLifecycle.transition(from, { type }, { ...ready, ...override })),
    ).toMatchObject({
      code: 'transition_guard_failed',
      details: { reason },
    });
  });

  it.each([
    ['draft', 'start'],
    ['completed', 'cancel'],
    ['archived', 'publish'],
    ['canceled', 'open_registration'],
    ['published', 'complete'],
  ] as const)('rejects %s → %s', (from, type) => {
    expect(() => tournamentLifecycle.transition(from, { type }, ready)).toThrow(
      InvalidTransitionError,
    );
  });

  it('can be canceled before it ends, and archived once canceled', () => {
    for (const from of [
      'draft',
      'published',
      'registration_open',
      'registration_closed',
      'seeding',
      'in_progress',
    ] as const) {
      expect(tournamentLifecycle.transition(from, { type: 'cancel' }, ready)).toBe('canceled');
    }
    expect(tournamentLifecycle.transition('canceled', { type: 'archive' }, ready)).toBe('archived');
  });
});

describe('match lifecycle', () => {
  const ctx = (overrides: Partial<MatchContext> = {}): MatchContext => ({
    entrantA: 'A',
    entrantB: 'B',
    checkedIn: ['A', 'B'],
    result: { scoreA: 2, scoreB: 1, winner: 'A' },
    disputeDeadline: null,
    ...overrides,
  });

  it('runs from scheduling to completion', () => {
    const steps = [
      ['pending', { type: 'schedule' }, 'scheduled'],
      ['scheduled', { type: 'schedule' }, 'scheduled'],
      ['scheduled', { type: 'open_checkin' }, 'checkin'],
      ['checkin', { type: 'checkin_complete' }, 'ready'],
      ['ready', { type: 'go_live' }, 'live'],
      ['live', { type: 'finish_games' }, 'awaiting_result'],
      ['awaiting_result', { type: 'confirm_result' }, 'completed'],
    ] as const;
    for (const [from, event, to] of steps) {
      expect(matchLifecycle.transition(from, event, ctx())).toBe(to);
    }
  });

  it('does not go live without check-in from both entrants', () => {
    expect(
      thrown(() =>
        matchLifecycle.transition('ready', { type: 'go_live' }, ctx({ checkedIn: ['A'] })),
      ),
    ).toMatchObject({
      code: 'transition_guard_failed',
      details: { reason: 'checkin_missing' },
    });
    expect(() =>
      matchLifecycle.transition('checkin', { type: 'checkin_complete' }, ctx({ checkedIn: [] })),
    ).toThrow(TransitionGuardError);
    expect(() => matchLifecycle.transition('checkin', { type: 'go_live' }, ctx())).toThrow(
      InvalidTransitionError,
    );
  });

  it('cannot be scheduled before both entrants are known', () => {
    expect(
      thrown(() =>
        matchLifecycle.transition('pending', { type: 'schedule' }, ctx({ entrantB: null })),
      ),
    ).toMatchObject({
      details: { reason: 'entrants_missing' },
    });
  });

  it('is not completed without a winner from the match', () => {
    expect(
      thrown(() =>
        matchLifecycle.transition(
          'awaiting_result',
          { type: 'confirm_result' },
          ctx({ result: null }),
        ),
      ),
    ).toMatchObject({
      details: { reason: 'winner_missing' },
    });
    const outsider = ctx({ result: { scoreA: 2, scoreB: 0, winner: 'X' } });
    expect(() =>
      matchLifecycle.transition('awaiting_result', { type: 'confirm_result' }, outsider),
    ).toThrow(TransitionGuardError);
  });

  it('opens a dispute while awaiting the result or within the window after completion', () => {
    expect(
      matchLifecycle.transition(
        'awaiting_result',
        { type: 'dispute', at: '2026-10-24T10:00:00Z' },
        ctx(),
      ),
    ).toBe('disputed');
    const window = ctx({ disputeDeadline: '2026-10-25T10:00:00Z' });
    expect(
      matchLifecycle.transition(
        'completed',
        { type: 'dispute', at: '2026-10-25T09:59:59Z' },
        window,
      ),
    ).toBe('disputed');
    expect(
      thrown(() =>
        matchLifecycle.transition(
          'completed',
          { type: 'dispute', at: '2026-10-25T10:00:01Z' },
          window,
        ),
      ),
    ).toMatchObject({
      details: { reason: 'dispute_window_closed' },
    });
    expect(() =>
      matchLifecycle.transition(
        'completed',
        { type: 'dispute', at: '2026-10-24T10:00:00Z' },
        ctx(),
      ),
    ).toThrow(TransitionGuardError);
    expect(matchLifecycle.transition('disputed', { type: 'confirm_result' }, ctx())).toBe(
      'completed',
    );
  });

  it('forfeits an entrant of the match before the result is final', () => {
    for (const from of ['scheduled', 'checkin', 'ready', 'live', 'awaiting_result'] as const) {
      expect(matchLifecycle.transition(from, { type: 'forfeit', entrantId: 'B' }, ctx())).toBe(
        'forfeit',
      );
    }
    expect(
      thrown(() =>
        matchLifecycle.transition('checkin', { type: 'forfeit', entrantId: 'X' }, ctx()),
      ),
    ).toMatchObject({
      details: { reason: 'entrant_not_in_match' },
    });
    expect(() =>
      matchLifecycle.transition('completed', { type: 'forfeit', entrantId: 'B' }, ctx()),
    ).toThrow(InvalidTransitionError);
  });

  it('can be rescheduled from check-in and canceled until it is final', () => {
    expect(matchLifecycle.transition('checkin', { type: 'schedule' }, ctx())).toBe('scheduled');
    expect(matchLifecycle.transition('live', { type: 'cancel' }, ctx())).toBe('canceled');
    for (const from of ['completed', 'forfeit', 'canceled'] as const) {
      expect(() => matchLifecycle.transition(from, { type: 'cancel' }, ctx())).toThrow(
        InvalidTransitionError,
      );
    }
  });
});

describe('game lifecycle', () => {
  const ctx = (winner: string | null = 'blue-team'): GameContext => ({
    blue: 'blue-team',
    red: 'red-team',
    winner,
  });

  it('goes from lobby to a finished game', () => {
    expect(gameLifecycle.transition('pending', { type: 'open_lobby' }, ctx())).toBe('lobby');
    expect(gameLifecycle.transition('lobby', { type: 'start' }, ctx())).toBe('live');
    expect(gameLifecycle.transition('live', { type: 'complete' }, ctx())).toBe('completed');
  });

  it('requires a winner from one of the sides to complete or forfeit', () => {
    expect(
      thrown(() => gameLifecycle.transition('live', { type: 'complete' }, ctx(null))),
    ).toMatchObject({
      details: { reason: 'winner_missing' },
    });
    expect(() =>
      gameLifecycle.transition('live', { type: 'forfeit' }, ctx('someone-else')),
    ).toThrow(TransitionGuardError);
    expect(gameLifecycle.transition('pending', { type: 'forfeit' }, ctx('red-team'))).toBe(
      'forfeit',
    );
  });

  it('remakes only a game that started its lobby', () => {
    expect(gameLifecycle.transition('live', { type: 'remake' }, ctx())).toBe('remade');
    expect(gameLifecycle.transition('lobby', { type: 'remake' }, ctx())).toBe('remade');
    expect(() => gameLifecycle.transition('completed', { type: 'remake' }, ctx())).toThrow(
      InvalidTransitionError,
    );
    expect(() => gameLifecycle.transition('pending', { type: 'start' }, ctx())).toThrow(
      InvalidTransitionError,
    );
  });
});
