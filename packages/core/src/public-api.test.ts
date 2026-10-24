// The examples of README.md, run against the public entry point.
import { describe, expect, it } from 'vitest';

import {
  computeFearlessLocks,
  createFormatRegistry,
  DEFAULT_POINTS_RULE,
  evaluateEligibility,
  matchLifecycle,
  resolveSeries,
  validateDraft,
  type Entrant,
  type Match,
} from './index.js';

const teams: Entrant[] = [
  { id: 'aurora', seed: 1 },
  { id: 'basalto', seed: 2 },
  { id: 'cenit', seed: 3 },
  { id: 'duna', seed: 4 },
];

describe('README examples', () => {
  it('runs a round robin season and explains the table', () => {
    const registry = createFormatRegistry();
    const season = registry.get('round_robin');

    let matches = season.generateMatches(teams, { seriesFormat: 'bo3' });
    for (const match of matches) {
      // Lower seed wins 2-1 (the API would score the series from its games).
      const winner = match.entrantA ?? '';
      const done: Match = {
        ...match,
        status: 'completed',
        result: { scoreA: 2, scoreB: 1, winner },
      };
      matches = season.onMatchCompleted(matches, done);
    }

    const standings = season.computeStandings(matches, DEFAULT_POINTS_RULE, [
      'head_to_head',
      'game_diff',
    ]);
    expect(standings.map((s) => [s.rank, s.entrantId, s.points])).toHaveLength(4);
    expect(season.isComplete(matches, { seriesFormat: 'bo3' })).toBe(true);
    expect(season.resolveAdvancement(standings, { count: 2 }).status).toMatch(
      /resolved|requires_tiebreaker/,
    );
  });

  it('builds a flash cup bracket with a Bo3 final', () => {
    const flash = createFormatRegistry().get('single_elimination');
    const bracket = flash.generateMatches(teams.slice(0, 3), {
      seriesFormat: 'bo1',
      finalSeriesFormat: 'bo3',
    });
    expect(bracket.map((m) => [m.id, m.entrantA, m.entrantB, m.seriesFormat])).toEqual([
      ['r1-m2', 'basalto', 'cenit', 'bo1'],
      ['r2-m1', 'aurora', null, 'bo3'],
    ]);
  });

  it('scores a series, applies Fearless and checks eligibility', () => {
    const series = resolveSeries({
      format: 'bo3',
      entrantA: 'aurora',
      entrantB: 'basalto',
      games: [
        { number: 1, status: 'completed', blue: 'aurora', red: 'basalto', winner: 'aurora' },
        { number: 2, status: 'completed', blue: 'basalto', red: 'aurora', winner: 'aurora' },
      ],
    });
    expect(series).toEqual({ scoreA: 2, scoreB: 0, isComplete: true, winner: 'aurora' });

    const locks = computeFearlessLocks(
      {
        entrants: ['aurora', 'basalto'],
        games: [
          {
            number: 1,
            status: 'completed',
            blue: 'aurora',
            red: 'basalto',
            winner: 'aurora',
            picks: [{ entrantId: 'aurora', championId: 103 }],
          },
        ],
      },
      { mode: 'per_team' },
    );
    expect(
      validateDraft(locks, [{ entrantId: 'aurora', championId: 103 }], ['aurora', 'basalto'])
        .violations,
    ).toEqual([
      { reason: 'champion_locked', entrantId: 'aurora', championId: 103, lockedByGame: 1 },
    ]);

    const result = evaluateEligibility(
      {
        entrantId: null,
        teamId: 'team-aurora',
        players: [
          { userId: 'u1', riotAccountVerified: true, rank: { tier: 'platinum', division: 2 } },
        ],
      },
      [
        { type: 'riot_account_verified' },
        { type: 'rank_max', params: { rank: { tier: 'gold', division: 1 } } },
      ],
      {
        now: '2026-10-24T12:00:00Z',
        tournament: { id: 't1', tier: 3, seasonId: null, circuitId: null },
      },
    );
    expect(result.failed.map((f) => [f.userId, f.reason, f.details])).toEqual([
      ['u1', 'rank_above_max', { rank: 'platinum_2', max: 'gold_1' }],
    ]);

    expect(() =>
      matchLifecycle.transition(
        'ready',
        { type: 'go_live' },
        {
          entrantA: 'aurora',
          entrantB: 'basalto',
          checkedIn: ['aurora'],
          result: null,
          disputeDeadline: null,
        },
      ),
    ).toThrow(expect.objectContaining({ code: 'transition_guard_failed' }) as Error);
  });
});
