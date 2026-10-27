import { describe, expect, it } from 'vitest';

import type { RosterMembership } from '../eligibility/eligibility.js';
import {
  InvalidFormatConfigError,
  InvalidSeedingError,
  InvalidTransitionError,
  LockedSectionError,
  RosterRuleError,
  TransitionGuardError,
} from '../errors.js';
import { createFormatRegistry } from '../formats/registry.js';
import { editPolicy, TOURNAMENT_SECTIONS, changesNeedingConfirmation } from './edit-policy.js';
import { entrantLifecycle } from './entrant.js';
import { assertValidRoster, validateRoster, type RosterRules } from './roster.js';
import { averageRankValue, seedEntrants } from './seeding.js';
import { describeStructure } from './structure.js';
import { effectiveEligibilityRules, exclusivityKey, rosterExclusivityKey } from './rules.js';

const tournament = { id: 't1', seasonId: 's1', circuitId: null };
const NOW = '2026-10-26T12:00:00.000Z';

const membership = (overrides: Partial<RosterMembership>): RosterMembership => ({
  entrantId: 'e-other',
  teamId: 'team-a',
  tournamentId: 't-other',
  seasonId: 's1',
  circuitId: null,
  tier: 3,
  joinedAt: '2026-10-01T00:00:00.000Z',
  leftAt: null,
  ...overrides,
});

describe('effectiveEligibilityRules', () => {
  it('adds the tournament exclusivity scope, with the leave cooldown', () => {
    expect(
      effectiveEligibilityRules([{ type: 'riot_account_verified' }], {
        exclusivityScope: 'season',
        leaveCooldownDays: 14,
      }),
    ).toEqual([
      { type: 'riot_account_verified' },
      { type: 'exclusivity', params: { scope: 'season', cooldownDays: 14 } },
    ]);
  });

  it('replaces a configured exclusivity rule and skips scope none', () => {
    const rules = [{ type: 'exclusivity' as const, params: { scope: 'circuit' as const } }];
    expect(effectiveEligibilityRules(rules, { exclusivityScope: 'none' })).toEqual([]);
    expect(effectiveEligibilityRules(rules, { exclusivityScope: 'tournament' })).toEqual([
      { type: 'exclusivity', params: { scope: 'tournament', cooldownDays: 0 } },
    ]);
  });
});

describe('exclusivityKey', () => {
  it('names the scope the database index locks', () => {
    expect(exclusivityKey('tournament', tournament)).toBe('tournament:t1');
    expect(exclusivityKey('season', tournament)).toBe('season:s1');
    expect(exclusivityKey('circuit', { ...tournament, circuitId: 'c1' })).toBe('circuit:c1');
    expect(exclusivityKey('none', tournament)).toBeNull();
  });

  it('is null when the tournament has no season or circuit, like the eligibility rule', () => {
    expect(exclusivityKey('circuit', tournament)).toBeNull();
    expect(exclusivityKey('season', { ...tournament, seasonId: null })).toBeNull();
  });
});

describe('rosterExclusivityKey', () => {
  it('locks the scope for a new registration', () => {
    expect(rosterExclusivityKey('season', tournament, 'team-a', [], NOW)).toBe('season:s1');
  });

  it('is null when the same team already holds the scope (a second league of the season)', () => {
    expect(rosterExclusivityKey('season', tournament, 'team-a', [membership({})], NOW)).toBeNull();
  });

  it('keeps the key for another team, so the database rejects the conflict', () => {
    expect(rosterExclusivityKey('season', tournament, 'team-b', [membership({})], NOW)).toBe(
      'season:s1',
    );
    expect(
      rosterExclusivityKey('season', tournament, null, [membership({ teamId: null })], NOW),
    ).toBe('season:s1');
  });

  it('ignores rosters that already ended or are outside the scope', () => {
    const past = membership({ leftAt: '2026-10-02T00:00:00.000Z' });
    const otherSeason = membership({ seasonId: 's0' });
    expect(rosterExclusivityKey('season', tournament, 'team-a', [past, otherSeason], NOW)).toBe(
      'season:s1',
    );
    expect(rosterExclusivityKey('none', tournament, 'team-a', [], NOW)).toBeNull();
  });
});

describe('validateRoster', () => {
  const rules: RosterRules = { starters: 2, maxSubstitutes: 1, coachAllowed: false };
  const members = [
    { userId: 'u1', role: 'captain' as const },
    { userId: 'u2', role: 'player' as const },
    { userId: 'u3', role: 'substitute' as const },
    { userId: 'u4', role: 'coach' as const },
  ];

  it('accepts a roster that fits the rules', () => {
    const roster = [
      { userId: 'u1', role: 'starter' as const },
      { userId: 'u2', role: 'starter' as const },
      { userId: 'u3', role: 'substitute' as const },
    ];
    expect(validateRoster(rules, roster, members)).toEqual([]);
    expect(() => {
      assertValidRoster(rules, roster, members);
    }).not.toThrow();
  });

  it('reports every violation with its details', () => {
    const roster = [
      { userId: 'u1', role: 'starter' as const },
      { userId: 'u1', role: 'substitute' as const },
      { userId: 'u3', role: 'substitute' as const },
      { userId: 'u4', role: 'coach' as const },
      { userId: 'u9', role: 'substitute' as const },
    ];
    expect(validateRoster(rules, roster, members).map((v) => v.reason)).toEqual([
      'duplicate_player',
      'starters_count',
      'too_many_substitutes',
      'coach_not_allowed',
      'not_a_team_member',
    ]);
  });

  it('keeps coaches and managers off the playing roster, and allows one coach', () => {
    const withCoach = { ...rules, coachAllowed: true };
    expect(
      validateRoster(
        withCoach,
        [
          { userId: 'u1', role: 'starter' },
          { userId: 'u4', role: 'starter' },
          { userId: 'u2', role: 'coach' },
          { userId: 'u3', role: 'coach' },
        ],
        members,
      ),
    ).toEqual([
      { reason: 'too_many_coaches', details: { max: 1, actual: 2 } },
      { reason: 'not_a_playing_member', details: { userId: 'u4' } },
    ]);
  });

  it('skips the team checks for solo entrants and throws a typed error', () => {
    const solo: RosterRules = { starters: 1, maxSubstitutes: 0, coachAllowed: false };
    expect(validateRoster(solo, [{ userId: 'u9', role: 'starter' }], null)).toEqual([]);
    expect(() => {
      assertValidRoster(solo, [], null);
    }).toThrow(RosterRuleError);
  });
});

describe('editPolicy (docs/14 §3.2)', () => {
  it('lets a draft change everything', () => {
    expect(TOURNAMENT_SECTIONS.every((s) => editPolicy('draft')[s] === 'free')).toBe(true);
  });

  it('asks for confirmation on eligibility and format once registration is open', () => {
    const policy = editPolicy('registration_open');
    expect(policy.basics).toBe('free');
    expect(policy.schedule).toBe('free');
    expect(policy.capacity).toBe('free');
    expect(policy.eligibility).toBe('confirm');
    expect(policy.format).toBe('confirm');
  });

  it('locks the registration rules in progress and everything once finished', () => {
    expect(editPolicy('in_progress').eligibility).toBe('locked');
    expect(editPolicy('in_progress').format).toBe('confirm');
    expect(editPolicy('in_progress').basics).toBe('free');
    for (const status of ['completed', 'canceled', 'archived'] as const) {
      expect(TOURNAMENT_SECTIONS.every((s) => editPolicy(status)[s] === 'locked')).toBe(true);
    }
  });

  it('lists the changed sections that need confirmation and refuses locked ones', () => {
    expect(changesNeedingConfirmation('published', ['basics', 'format', 'eligibility'])).toEqual([
      'format',
      'eligibility',
    ]);
    expect(changesNeedingConfirmation('draft', ['format'])).toEqual([]);
    expect(() => changesNeedingConfirmation('in_progress', ['eligibility'])).toThrow(
      LockedSectionError,
    );
  });
});

describe('entrantLifecycle', () => {
  const room = { approvedEntrants: 1, capacity: 2 };

  it('approves within capacity and rejects with a reason when full', () => {
    expect(entrantLifecycle.transition('pending', { type: 'approve' }, room)).toBe('approved');
    expect(entrantLifecycle.transition('waitlisted', { type: 'approve' }, room)).toBe('approved');
    expect(() =>
      entrantLifecycle.transition('pending', { type: 'approve' }, { ...room, approvedEntrants: 2 }),
    ).toThrow(TransitionGuardError);
    expect(
      entrantLifecycle.can(
        'pending',
        { type: 'approve' },
        { approvedEntrants: 99, capacity: null },
      ),
    ).toBe(true);
  });

  it('moves through the waitlist and ends in a final state', () => {
    expect(entrantLifecycle.transition('pending', { type: 'waitlist' }, room)).toBe('waitlisted');
    expect(entrantLifecycle.transition('waitlisted', { type: 'promote' }, room)).toBe('pending');
    expect(entrantLifecycle.transition('approved', { type: 'withdraw' }, room)).toBe('withdrawn');
    expect(entrantLifecycle.transition('approved', { type: 'disqualify' }, room)).toBe(
      'disqualified',
    );
    expect(entrantLifecycle.transition('pending', { type: 'reject' }, room)).toBe('rejected');
    expect(() => entrantLifecycle.transition('rejected', { type: 'approve' }, room)).toThrow(
      InvalidTransitionError,
    );
  });
});

describe('seedEntrants', () => {
  const candidates = [
    { entrantId: 'a', averageRank: 10, registeredAt: '2026-10-01T00:00:00.000Z' },
    { entrantId: 'b', averageRank: 30, registeredAt: '2026-10-03T00:00:00.000Z' },
    { entrantId: 'c', averageRank: 30, registeredAt: '2026-10-02T00:00:00.000Z' },
  ];

  it('seeds by average rank, the earliest registration first on ties', () => {
    expect(seedEntrants('rank', candidates)).toEqual([
      { entrantId: 'c', seed: 1 },
      { entrantId: 'b', seed: 2 },
      { entrantId: 'a', seed: 3 },
    ]);
  });

  it('shuffles with the injected random source', () => {
    const seeds = seedEntrants('random', candidates, { random: () => 0 });
    expect(seeds.map((s) => s.entrantId)).toEqual(['b', 'c', 'a']);
    expect(seeds.map((s) => s.seed)).toEqual([1, 2, 3]);
  });

  it('accepts a manual order that is a permutation of 1..n', () => {
    expect(seedEntrants('manual', candidates, { manual: { a: 2, b: 3, c: 1 } })).toEqual([
      { entrantId: 'c', seed: 1 },
      { entrantId: 'a', seed: 2 },
      { entrantId: 'b', seed: 3 },
    ]);
    expect(() => seedEntrants('manual', candidates, { manual: { a: 1, b: 1, c: 2 } })).toThrow(
      InvalidSeedingError,
    );
    expect(() => seedEntrants('manual', candidates, { manual: { a: 1, b: 2 } })).toThrow(
      InvalidSeedingError,
    );
    expect(() => seedEntrants('random', candidates)).toThrow(InvalidSeedingError);
  });

  it('averages ranks, unranked counting as the lowest value', () => {
    expect(averageRankValue([])).toBe(0);
    expect(averageRankValue([{ tier: 'gold', division: 4 }, null])).toBeGreaterThan(0);
    expect(averageRankValue([{ tier: 'master' }])).toBeGreaterThan(
      averageRankValue([{ tier: 'diamond', division: 1 }]),
    );
  });
});

describe('describeStructure', () => {
  const registry = createFormatRegistry();

  it('sizes a flash single elimination for its capacity', () => {
    expect(
      describeStructure(
        registry,
        [{ format: 'single_elimination', config: { seriesFormat: 'bo1' }, advance: null }],
        16,
      ),
    ).toEqual([{ entrants: 16, rounds: 4, matches: 15, groups: [] }]);
  });

  it('chains phases: the advancing entrants of one phase play the next', () => {
    const phases = [
      { format: 'groups', config: { seriesFormat: 'bo1', groupCount: 2 }, advance: 2 },
      { format: 'single_elimination', config: { seriesFormat: 'bo3' }, advance: null },
    ];
    expect(describeStructure(registry, phases, 8)).toEqual([
      { entrants: 8, rounds: 3, matches: 12, groups: [4, 4] },
      { entrants: 4, rounds: 2, matches: 3, groups: [] },
    ]);
  });

  it('counts a league round robin and the planned Swiss rounds', () => {
    expect(
      describeStructure(
        registry,
        [{ format: 'round_robin', config: { seriesFormat: 'bo3', legs: 1 }, advance: 4 }],
        6,
      ),
    ).toEqual([{ entrants: 6, rounds: 5, matches: 15, groups: [] }]);
    expect(
      describeStructure(
        registry,
        [{ format: 'swiss', config: { seriesFormat: 'bo1', rounds: 3 }, advance: null }],
        8,
      ),
    ).toEqual([{ entrants: 8, rounds: 3, matches: 12, groups: [] }]);
  });

  it('rejects invalid configurations through the format strategies', () => {
    expect(() =>
      describeStructure(
        registry,
        [{ format: 'groups', config: { seriesFormat: 'bo1', groupCount: 4 }, advance: 1 }],
        6,
      ),
    ).toThrow(InvalidFormatConfigError);
    expect(() =>
      describeStructure(
        registry,
        [
          { format: 'round_robin', config: { seriesFormat: 'bo1' }, advance: 1 },
          { format: 'single_elimination', config: { seriesFormat: 'bo1' }, advance: null },
        ],
        4,
      ),
    ).toThrow(InvalidFormatConfigError);
    expect(() => describeStructure(registry, [], 4)).toThrow(InvalidFormatConfigError);
  });
});
