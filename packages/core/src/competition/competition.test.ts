import { describe, expect, it } from 'vitest';

import { InvalidScheduleError, InvalidSeriesError } from '../errors.js';
import { createFormatRegistry } from '../formats/registry.js';
import type { Entrant, Match } from '../types.js';
import { checkinOutcome, checkinWindow, disputeDeadline } from './checkin.js';
import { phaseProgress, seedsFromAdvancement } from './progress.js';
import { reconcileReports, scoreReport } from './reports.js';
import { autoSchedule, isWithinWindows, zonedTime } from './schedule.js';

const registry = createFormatRegistry();
const TZ = 'America/Mexico_City';

describe('scoreReport', () => {
  it('scores a series from the reported game winners with packages/core series rules', () => {
    expect(
      scoreReport('bo3', 'a', 'b', [
        { number: 1, winner: 'a' },
        { number: 2, winner: 'b' },
        { number: 3, winner: 'a' },
      ]),
    ).toEqual({ scoreA: 2, scoreB: 1, isComplete: true, winner: 'a' });
  });

  it('refuses an unfinished or impossible series', () => {
    expect(() => scoreReport('bo3', 'a', 'b', [{ number: 1, winner: 'a' }])).toThrow(
      InvalidSeriesError,
    );
    expect(() =>
      scoreReport('bo1', 'a', 'b', [
        { number: 1, winner: 'a' },
        { number: 2, winner: 'b' },
      ]),
    ).toThrow(InvalidSeriesError);
  });
});

describe('reconcileReports (dual report)', () => {
  const win = (entrantId: string, ...games: ('a' | 'b')[]) => ({
    entrantId,
    games: games.map((winner, i) => ({ number: i + 1, winner })),
  });

  it('waits for both captains', () => {
    expect(reconcileReports('bo1', 'a', 'b', [win('a', 'a')])).toEqual({ status: 'waiting' });
  });

  it('confirms when both reports give the same winner and score', () => {
    const result = reconcileReports('bo3', 'a', 'b', [win('a', 'a', 'a'), win('b', 'a', 'a')]);
    expect(result).toMatchObject({
      status: 'agreed',
      outcome: { winner: 'a', scoreA: 2, scoreB: 0 },
    });
  });

  it('disputes when they differ, saying why', () => {
    expect(reconcileReports('bo1', 'a', 'b', [win('a', 'a'), win('b', 'b')])).toEqual({
      status: 'disputed',
      reason: 'winner_mismatch',
    });
    expect(
      reconcileReports('bo3', 'a', 'b', [win('a', 'a', 'a'), win('b', 'a', 'b', 'a')]),
    ).toEqual({ status: 'disputed', reason: 'score_mismatch' });
  });

  it('uses the latest report of each side', () => {
    const result = reconcileReports('bo1', 'a', 'b', [win('a', 'b'), win('b', 'a'), win('a', 'a')]);
    expect(result.status).toBe('agreed');
  });
});

describe('check-in', () => {
  it('opens and closes relative to the scheduled time', () => {
    expect(checkinWindow('2026-11-14T18:00:00.000Z', 30, 10)).toEqual({
      opensAt: '2026-11-14T17:30:00.000Z',
      closesAt: '2026-11-14T17:50:00.000Z',
    });
  });

  it('is ready with both, forfeits the absent one, and leaves a double no-show to staff', () => {
    expect(checkinOutcome('a', 'b', ['a', 'b'])).toEqual({ kind: 'ready' });
    expect(checkinOutcome('a', 'b', ['b'])).toEqual({ kind: 'forfeit', loser: 'a', winner: 'b' });
    expect(checkinOutcome('a', 'b', [])).toEqual({ kind: 'no_show' });
  });

  it('closes disputes a number of hours after the result', () => {
    expect(disputeDeadline('2026-11-14T18:00:00.000Z', 24)).toBe('2026-11-15T18:00:00.000Z');
  });
});

describe('schedule', () => {
  // Saturdays 12:00–15:00 in Mexico City, 60 min per series, 2 at a time.
  const windows = [
    { weekday: 6, startTime: '12:00', endTime: '15:00', slotMinutes: 60, parallelMatches: 2 },
  ];

  it('converts a wall clock time of the event time zone', () => {
    expect(zonedTime('2026-11-14', '12:00', TZ).toISOString()).toBe('2026-11-14T18:00:00.000Z');
  });

  it('places each round after the previous one, filling parallel slots', () => {
    const matches = [
      { id: 'r1-m1', round: 1 },
      { id: 'r1-m2', round: 1 },
      { id: 'r1-m3', round: 1 },
      { id: 'r2-m1', round: 2 },
    ];
    const plan = autoSchedule(matches, windows, [], TZ, '2026-11-13T00:00:00.000Z');
    expect(Object.fromEntries(plan)).toEqual({
      'r1-m1': '2026-11-14T18:00:00.000Z',
      'r1-m2': '2026-11-14T18:00:00.000Z',
      'r1-m3': '2026-11-14T19:00:00.000Z',
      'r2-m1': '2026-11-14T20:00:00.000Z',
    });
  });

  it('skips blackouts and moves to the next window', () => {
    const blackouts = [
      { startsAt: '2026-11-14T00:00:00.000Z', endsAt: '2026-11-15T12:00:00.000Z' },
    ];
    const plan = autoSchedule(
      [{ id: 'm', round: 1 }],
      windows,
      blackouts,
      TZ,
      '2026-11-13T00:00:00.000Z',
    );
    expect(plan.get('m')).toBe('2026-11-21T18:00:00.000Z');
  });

  it('checks a time against the windows', () => {
    expect(isWithinWindows('2026-11-14T19:00:00.000Z', windows, [], TZ)).toBe(true);
    // 14:30 local leaves no room for a 60 minute series before 15:00.
    expect(isWithinWindows('2026-11-14T20:30:00.000Z', windows, [], TZ)).toBe(false);
    expect(isWithinWindows('2026-11-15T19:00:00.000Z', windows, [], TZ)).toBe(false);
    expect(
      isWithinWindows(
        '2026-11-14T19:00:00.000Z',
        windows,
        [{ startsAt: '2026-11-14T18:30:00.000Z', endsAt: '2026-11-14T19:30:00.000Z' }],
        TZ,
      ),
    ).toBe(false);
  });

  it('needs windows', () => {
    expect(() =>
      autoSchedule([{ id: 'm', round: 1 }], [], [], TZ, '2026-11-13T00:00:00.000Z'),
    ).toThrow(InvalidScheduleError);
  });
});

describe('phaseProgress', () => {
  const entrants: Entrant[] = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, seed: i + 1 }));
  const play = (
    strategy: ReturnType<typeof registry.get>,
    matches: Match[],
    winnerOf: (m: Match) => string,
  ) => {
    let current = matches;
    for (;;) {
      const next = current.find((m) => m.status === 'pending' && m.entrantA && m.entrantB);
      if (!next) return current;
      const winner = winnerOf(next);
      current = strategy.onMatchCompleted(current, {
        ...next,
        status: 'completed',
        result: {
          scoreA: winner === next.entrantA ? 1 : 0,
          scoreB: winner === next.entrantB ? 1 : 0,
          winner,
        },
      });
    }
  };
  const points = { win: 3, loss: 0, draw: 1 };
  // A variable, not a literal: the registry types the generic strategy loosely.
  const ROUND_ROBIN = { seriesFormat: 'bo1' as const, legs: 1 as const };

  it('marks single elimination losers as eliminated while the bracket is played', () => {
    const strategy = registry.get('single_elimination');
    const matches = strategy.generateMatches(entrants, { seriesFormat: 'bo1' });
    const first = matches.find((m) => m.round === 1);
    if (!first?.entrantA) throw new Error('fixture');
    const after = strategy.onMatchCompleted(matches, {
      ...first,
      status: 'completed',
      result: { scoreA: 1, scoreB: 0, winner: first.entrantA },
    });
    const progress = phaseProgress(strategy, after, { seriesFormat: 'bo1' }, points, [], null);
    expect(progress.complete).toBe(false);
    expect(progress.statuses[first.entrantB ?? '']).toBe('eliminated');
    expect(progress.statuses[first.entrantA]).toBe('active');
  });

  it('crowns the champion when the last phase is complete', () => {
    const strategy = registry.get('single_elimination');
    const done = play(
      strategy,
      strategy.generateMatches(entrants, { seriesFormat: 'bo1' }),
      (m) => m.entrantA ?? '',
    );
    const progress = phaseProgress(strategy, done, { seriesFormat: 'bo1' }, points, [], null);
    expect(progress.complete).toBe(true);
    expect(progress.champion).toBe('a');
    expect(progress.statuses.a).toBe('advanced');
  });

  it('resolves who advances from a round robin and seeds the next phase', () => {
    const strategy = registry.get('round_robin');
    const done = play(
      strategy,
      strategy.generateMatches(entrants, ROUND_ROBIN),
      (m) => [m.entrantA ?? '', m.entrantB ?? ''].sort()[0] ?? '',
    );
    const progress = phaseProgress(
      strategy,
      done,
      { seriesFormat: 'bo1', legs: 1 },
      points,
      ['head_to_head'],
      2,
    );
    expect(progress.complete).toBe(true);
    expect(progress.standings.map((s) => s.entrantId)).toEqual(['a', 'b', 'c', 'd']);
    expect(progress.advancement).toMatchObject({ status: 'resolved', advancing: ['a', 'b'] });
    expect(progress.statuses).toMatchObject({ a: 'advanced', b: 'advanced', c: 'eliminated' });
    expect(progress.champion).toBeNull();
    expect(seedsFromAdvancement(progress.advancement)).toEqual([
      { id: 'a', seed: 1 },
      { id: 'b', seed: 2 },
    ]);
  });

  it('keeps everybody in contention while a table phase is open', () => {
    const strategy = registry.get('round_robin');
    const matches = strategy.generateMatches(entrants, ROUND_ROBIN);
    const progress = phaseProgress(
      strategy,
      matches,
      { seriesFormat: 'bo1', legs: 1 },
      points,
      [],
      2,
    );
    expect(progress.complete).toBe(false);
    expect(progress.advancement).toBeNull();
    expect(Object.values(progress.statuses).every((s) => s === 'active')).toBe(true);
    expect(seedsFromAdvancement(null)).toEqual([]);
  });
});
