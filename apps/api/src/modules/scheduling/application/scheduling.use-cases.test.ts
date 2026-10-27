import { describe, expect, it } from 'vitest';

import { ApplicationError } from '../../../shared/application-error.js';
import { GenerateFixturesUseCase } from '../../matches/application/matches.use-cases.js';
import {
  ADMIN,
  captainOf,
  setup,
  STRANGER,
  TOURNAMENT,
} from '../../matches/testing/competition-fixture.js';
import {
  AutoScheduleUseCase,
  DecideRescheduleUseCase,
  RequestRescheduleUseCase,
  RespondRescheduleUseCase,
  SetScheduleUseCase,
} from './scheduling.use-cases.js';

async function rejects(promise: Promise<unknown>, code: string) {
  const error: unknown = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApplicationError);
  expect((error as ApplicationError).code).toBe(code);
}

/** Saturdays 12:00–15:00 in Mexico City, 60 minutes per series, 2 at a time. */
async function scheduled() {
  const ctx = setup();
  const tournament = ctx.tournamentRepo.tournaments[0];
  if (!tournament) throw new Error('fixture');
  tournament.config = {
    ...tournament.config,
    schedule: {
      ...tournament.config.schedule,
      startsAt: '2026-11-20T00:00:00.000Z',
      windows: [
        { weekday: 6, startTime: '12:00', endTime: '15:00', slotMinutes: 60, parallelMatches: 2 },
      ],
    },
  };
  await new GenerateFixturesUseCase(ctx.deps).execute(ADMIN, TOURNAMENT);
  return ctx;
}

describe('AutoScheduleUseCase', () => {
  it('places the rounds in the windows with their check-in windows', async () => {
    const ctx = await scheduled();
    expect(await new AutoScheduleUseCase(ctx.deps).execute(ADMIN, TOURNAMENT)).toEqual({
      scheduled: 3,
    });
    const times = ctx.matches.matches.map((m) => [
      m.bracketKey,
      m.scheduledAt?.toISOString(),
      m.status,
    ]);
    expect(times).toEqual([
      ['r1-m1', '2026-11-21T18:00:00.000Z', 'scheduled'],
      ['r1-m2', '2026-11-21T18:00:00.000Z', 'scheduled'],
      // The final has no entrants yet: it gets its time but stays pending.
      ['r2-m1', '2026-11-21T19:00:00.000Z', 'pending'],
    ]);
    expect(ctx.matches.matches[0]?.checkinOpensAt?.toISOString()).toBe('2026-11-21T17:30:00.000Z');
    await rejects(new AutoScheduleUseCase(ctx.deps).execute(STRANGER, TOURNAMENT), 'staff_only');
  });

  it('needs a reason to move a scheduled match, and audits it', async () => {
    const ctx = await scheduled();
    await new AutoScheduleUseCase(ctx.deps).execute(ADMIN, TOURNAMENT);
    const match = ctx.matches.matches[0];
    if (!match) throw new Error('fixture');
    const set = new SetScheduleUseCase(ctx.deps);
    await rejects(
      set.execute(ADMIN, match.id, { scheduledAt: '2026-11-28T18:00:00.000Z', reason: null }),
      'reason_required',
    );
    const moved = await set.execute(ADMIN, match.id, {
      scheduledAt: '2026-11-28T18:00:00.000Z',
      reason: 'Conflicto con un evento de la sede',
    });
    expect(moved.scheduledAt).toBe('2026-11-28T18:00:00.000Z');
    expect(ctx.matches.matches[0]?.originalScheduledAt?.toISOString()).toBe(
      '2026-11-21T18:00:00.000Z',
    );
    expect(ctx.matches.audit.map((a) => a.action)).toContain('match.rescheduled');
  });
});

describe('reschedule requests', () => {
  it('goes from a captain proposal to the opponent acceptance and staff approval', async () => {
    const ctx = await scheduled();
    await new AutoScheduleUseCase(ctx.deps).execute(ADMIN, TOURNAMENT);
    const match = ctx.matches.matches[0];
    if (!match?.entrantA || !match.entrantB) throw new Error('fixture');
    const request = new RequestRescheduleUseCase(ctx.deps);

    await rejects(
      request.execute(captainOf(match.entrantA), match.id, {
        proposedAt: ['2026-11-22T18:00:00.000Z'],
        reason: null,
      }),
      'outside_schedule_windows',
    );
    const proposal = '2026-11-28T19:00:00.000Z';
    const requested = await request.execute(captainOf(match.entrantA), match.id, {
      proposedAt: [proposal],
      reason: 'Un titular viaja ese fin de semana',
    });
    const [pending] = requested.reschedules;
    if (!pending) throw new Error('no request');
    expect(requested.permissions?.canRequestReschedule).toBe(false);

    const respond = new RespondRescheduleUseCase(ctx.deps);
    await rejects(
      respond.execute(captainOf(match.entrantA), pending.id, {
        decision: 'accept',
        chosenAt: proposal,
      }),
      'not_the_opponent',
    );
    await rejects(
      respond.execute(captainOf(match.entrantB), pending.id, {
        decision: 'accept',
        chosenAt: '2026-12-01T00:00:00.000Z',
      }),
      'invalid_choice',
    );
    await respond.execute(captainOf(match.entrantB), pending.id, {
      decision: 'accept',
      chosenAt: proposal,
    });

    const approved = await new DecideRescheduleUseCase(ctx.deps).execute(ADMIN, pending.id, {
      decision: 'approve',
      reason: null,
    });
    expect(approved.scheduledAt).toBe(proposal);
    expect(approved.reschedules[0]?.status).toBe('approved_by_admin');
    expect(ctx.matches.events).toEqual(
      expect.arrayContaining(['reschedule.requested', 'reschedule.accepted', 'match.rescheduled']),
    );
  });
});
