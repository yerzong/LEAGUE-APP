import { describe, expect, it } from 'vitest';

import {
  IneligibleEntrantError,
  InvalidEligibilityRuleError,
  UnknownEligibilityRuleError,
} from '../errors.js';
import {
  assertEligible,
  evaluateEligibility,
  type EligibilityCandidate,
  type EligibilityContext,
  type EligibilityRule,
  type PlayerProfile,
  type RosterMembership,
} from './eligibility.js';
import { compareRanks, formatRank, rankValue } from './rank.js';
import { specification } from './specification.js';

const NOW = '2026-10-24T12:00:00.000Z';

const context: EligibilityContext = {
  now: NOW,
  tournament: { id: 't-flash', tier: 3, seasonId: 's-2026', circuitId: 'c-womens' },
};

const player = (overrides: Partial<PlayerProfile> = {}): PlayerProfile => ({
  userId: 'u1',
  riotAccountVerified: true,
  region: 'LA1',
  country: 'MX',
  rank: { tier: 'gold', division: 2 },
  rankHistory: [],
  accountLevel: 120,
  accountCreatedAt: '2024-01-01T00:00:00.000Z',
  rankedGamesThisSeason: 80,
  birthDate: '2004-05-10',
  legalNameProvided: true,
  rosters: [],
  sanctions: [],
  ...overrides,
});

const candidate = (...players: PlayerProfile[]): EligibilityCandidate => ({
  entrantId: 'entrant-1',
  teamId: 'team-1',
  players: players.length > 0 ? players : [player()],
});

const failuresOf = (rules: readonly EligibilityRule[], subject = candidate()) =>
  evaluateEligibility(subject, rules, context).failed.map((f) => [f.userId, f.reason]);

const roster = (overrides: Partial<RosterMembership>): RosterMembership => ({
  entrantId: 'other-entrant',
  teamId: 'other-team',
  tournamentId: 't-other',
  seasonId: null,
  circuitId: null,
  tier: 3,
  joinedAt: '2026-01-01T00:00:00.000Z',
  leftAt: null,
  ...overrides,
});

describe('ranks', () => {
  it('orders tiers and divisions, with apex tiers above diamond I', () => {
    expect(
      compareRanks({ tier: 'gold', division: 1 }, { tier: 'gold', division: 4 }),
    ).toBeGreaterThan(0);
    expect(compareRanks({ tier: 'master' }, { tier: 'diamond', division: 1 })).toBeGreaterThan(0);
    expect(rankValue(null)).toBeLessThan(rankValue({ tier: 'iron', division: 4 }));
    expect(formatRank({ tier: 'emerald', division: 3 })).toBe('emerald_3');
    expect(formatRank({ tier: 'challenger' })).toBe('challenger');
    expect(formatRank(null)).toBe('unranked');
  });
});

describe('specification combinators', () => {
  const even = specification<number>((n) => (n % 2 === 0 ? [] : [{ reason: 'odd', details: {} }]));
  const positive = specification<number>((n) =>
    n > 0 ? [] : [{ reason: 'not_positive', details: {} }],
  );

  it('composes with and / or / not', () => {
    expect(even.and(positive).check(4)).toEqual([]);
    // `and` short-circuits: a dependent check is not reported when its premise fails.
    expect(
      even
        .and(positive)
        .check(-3)
        .map((f) => f.reason),
    ).toEqual(['odd']);
    expect(
      even
        .and(positive)
        .check(-2)
        .map((f) => f.reason),
    ).toEqual(['not_positive']);
    expect(even.or(positive).check(3)).toEqual([]);
    expect(
      even
        .or(positive)
        .check(-3)
        .map((f) => f.reason),
    ).toEqual(['odd', 'not_positive']);
    expect(
      even
        .not({ reason: 'is_even', details: {} })
        .check(2)
        .map((f) => f.reason),
    ).toEqual(['is_even']);
    expect(even.not({ reason: 'is_even', details: {} }).check(1)).toEqual([]);
    expect(even.isSatisfiedBy(2)).toBe(true);
  });
});

describe('evaluateEligibility', () => {
  it('lists passed and failed rules, with the failing player and a reason code', () => {
    const rules: EligibilityRule[] = [
      { type: 'riot_account_verified' },
      { type: 'rank_max', params: { rank: { tier: 'gold', division: 1 } } },
    ];
    const subject = candidate(
      player(),
      player({ userId: 'u2', rank: { tier: 'platinum', division: 4 } }),
    );
    expect(evaluateEligibility(subject, rules, context)).toEqual({
      eligible: false,
      passed: [{ position: 0, rule: 'riot_account_verified' }],
      failed: [
        {
          position: 1,
          rule: 'rank_max',
          userId: 'u2',
          reason: 'rank_above_max',
          details: { rank: 'platinum_4', max: 'gold_1' },
        },
      ],
    });
  });

  it('is eligible with no rules', () => {
    expect(evaluateEligibility(candidate(), [], context)).toEqual({
      eligible: true,
      passed: [],
      failed: [],
    });
  });

  it.each<[string, EligibilityRule, Partial<PlayerProfile>, string]>([
    [
      'riot_account_verified',
      { type: 'riot_account_verified' },
      { riotAccountVerified: false },
      'riot_account_not_verified',
    ],
    [
      'region',
      { type: 'region', params: { regions: ['la1'] } },
      { region: 'NA1' },
      'region_not_allowed',
    ],
    [
      'region (missing)',
      { type: 'region', params: { regions: ['LA1'] } },
      { region: null },
      'region_not_allowed',
    ],
    [
      'country',
      { type: 'country', params: { countries: ['MX'] } },
      { country: 'AR' },
      'country_not_allowed',
    ],
    [
      'rank_min',
      { type: 'rank_min', params: { rank: { tier: 'gold', division: 4 } } },
      { rank: { tier: 'silver', division: 1 } },
      'rank_below_min',
    ],
    [
      'rank_min (unranked)',
      { type: 'rank_min', params: { rank: { tier: 'iron', division: 4 } } },
      { rank: null },
      'rank_below_min',
    ],
    [
      'rank_max',
      { type: 'rank_max', params: { rank: { tier: 'gold', division: 1 } } },
      { rank: { tier: 'master' } },
      'rank_above_max',
    ],
    [
      'account_level_min',
      { type: 'account_level_min', params: { level: 50 } },
      { accountLevel: 30 },
      'account_level_below_min',
    ],
    [
      'account_level_min (missing)',
      { type: 'account_level_min', params: { level: 50 } },
      { accountLevel: null },
      'account_level_below_min',
    ],
    [
      'account_age_min',
      { type: 'account_age_min', params: { days: 60 } },
      { accountCreatedAt: '2026-10-01T00:00:00.000Z' },
      'account_too_new',
    ],
    [
      'account_age_min (missing)',
      { type: 'account_age_min', params: { days: 60 } },
      { accountCreatedAt: null },
      'account_too_new',
    ],
    [
      'ranked_games_min',
      { type: 'ranked_games_min', params: { games: 50 } },
      { rankedGamesThisSeason: 12 },
      'ranked_games_below_min',
    ],
    [
      'age_min',
      { type: 'age_min', params: { years: 16 } },
      { birthDate: '2010-10-25' },
      'underage',
    ],
    [
      'age_min (missing)',
      { type: 'age_min', params: { years: 16 } },
      { birthDate: null },
      'birth_date_missing',
    ],
    [
      'legal_name_required',
      { type: 'legal_name_required' },
      { legalNameProvided: false },
      'legal_name_missing',
    ],
  ])('fails %s with a reason', (_label, rule, overrides, reason) => {
    expect(failuresOf([rule], candidate(player(overrides)))).toEqual([['u1', reason]]);
    expect(failuresOf([rule], candidate(player()))).toEqual([]);
  });

  it('computes age on the exact birthday', () => {
    const rule: EligibilityRule = { type: 'age_min', params: { years: 16 } };
    expect(failuresOf([rule], candidate(player({ birthDate: '2010-10-24' })))).toEqual([]);
  });

  describe('peak_rank_max', () => {
    const rule: EligibilityRule = {
      type: 'peak_rank_max',
      params: { rank: { tier: 'diamond', division: 1 }, windowDays: 90 },
    };

    it('uses the highest snapshot inside the window, not the current rank', () => {
      const deranked = player({
        rank: { tier: 'emerald', division: 2 },
        rankHistory: [
          { rank: { tier: 'master' }, takenAt: '2026-09-01T00:00:00.000Z' },
          { rank: { tier: 'emerald', division: 2 }, takenAt: '2026-10-20T00:00:00.000Z' },
        ],
      });
      expect(evaluateEligibility(candidate(deranked), [rule], context).failed[0]).toMatchObject({
        reason: 'peak_rank_above_max',
        details: { peak: 'master', max: 'diamond_1', windowDays: 90 },
      });
    });

    it('ignores snapshots older than the window', () => {
      const old = player({
        rankHistory: [{ rank: { tier: 'challenger' }, takenAt: '2025-01-01T00:00:00.000Z' }],
      });
      expect(failuresOf([rule], candidate(old))).toEqual([]);
    });
  });

  describe('team average', () => {
    const rule: EligibilityRule = {
      type: 'rank_max',
      params: { rank: { tier: 'platinum', division: 4 } },
      appliesTo: 'team_average',
    };

    it('compares the roster average, so one high player can be offset', () => {
      const balanced = candidate(
        player({ rank: { tier: 'diamond', division: 4 } }),
        player({ userId: 'u2', rank: { tier: 'silver', division: 4 } }),
      );
      expect(failuresOf([rule], balanced)).toEqual([]);
    });

    it('fails for the whole entrant, without a user', () => {
      const strong = candidate(
        player({ rank: { tier: 'diamond', division: 1 } }),
        player({ userId: 'u2', rank: { tier: 'master' } }),
      );
      expect(evaluateEligibility(strong, [rule], context).failed[0]).toMatchObject({
        userId: null,
        reason: 'team_average_above_max',
        details: { average: 'diamond_1', max: 'platinum_4' },
      });
    });

    it('is only available for rank rules', () => {
      expect(() =>
        evaluateEligibility(
          candidate(),
          [{ type: 'age_min', params: { years: 16 }, appliesTo: 'team_average' }],
          context,
        ),
      ).toThrow(InvalidEligibilityRuleError);
    });

    it('supports a minimum and the peak average', () => {
      const min: EligibilityRule = {
        type: 'rank_min',
        params: { rank: { tier: 'gold', division: 4 } },
        appliesTo: 'team_average',
      };
      expect(
        failuresOf([min], candidate(player({ rank: { tier: 'bronze', division: 1 } }))),
      ).toEqual([[null, 'team_average_below_min']]);
      const peak: EligibilityRule = {
        type: 'peak_rank_max',
        params: { rank: { tier: 'gold', division: 1 }, windowDays: 30 },
        appliesTo: 'team_average',
      };
      const history = [
        {
          rank: { tier: 'diamond' as const, division: 2 as const },
          takenAt: '2026-10-10T00:00:00.000Z',
        },
      ];
      expect(failuresOf([peak], candidate(player({ rankHistory: history })))).toEqual([
        [null, 'team_average_above_max'],
      ]);
    });
  });

  describe('gender', () => {
    const declared = (value: string, declaredAt = '2026-01-01T00:00:00.000Z') => ({
      gender: { value, declaredAt },
    });

    it('defaults to woman and non_binary', () => {
      const rule: EligibilityRule = { type: 'gender', params: {} };
      expect(failuresOf([rule], candidate(player(declared('woman'))))).toEqual([]);
      expect(failuresOf([rule], candidate(player(declared('non_binary'))))).toEqual([]);
      expect(failuresOf([rule], candidate(player(declared('man'))))).toEqual([
        ['u1', 'gender_not_allowed'],
      ]);
      expect(failuresOf([rule], candidate(player()))).toEqual([['u1', 'gender_not_declared']]);
    });

    it('requires the declaration before the event announcement when configured', () => {
      const rule: EligibilityRule = {
        type: 'gender',
        params: { allowed: ['woman'], declaredBefore: '2026-06-01T00:00:00.000Z' },
      };
      expect(
        failuresOf([rule], candidate(player(declared('woman', '2026-07-01T00:00:00.000Z')))),
      ).toEqual([['u1', 'gender_declared_too_late']]);
      expect(
        failuresOf([rule], candidate(player(declared('woman', '2026-05-01T00:00:00.000Z')))),
      ).toEqual([]);
    });
  });

  describe('institution', () => {
    const verified = (email: string, id = 'unam') => ({
      institution: { id, email, verified: true },
    });

    it('accepts a verified member by institution id or by email domain', () => {
      expect(
        failuresOf(
          [{ type: 'institution', params: { institutionId: 'unam' } }],
          candidate(player(verified('a@x.mx'))),
        ),
      ).toEqual([]);
      const byDomain: EligibilityRule = {
        type: 'institution',
        params: { emailDomains: ['alumno.ipn.mx'] },
      };
      expect(
        failuresOf([byDomain], candidate(player(verified('Ana@Alumno.IPN.mx', 'other')))),
      ).toEqual([]);
      expect(failuresOf([byDomain], candidate(player(verified('ana@gmail.com', 'other'))))).toEqual(
        [['u1', 'institution_mismatch']],
      );
    });

    it('requires a verified institutional email', () => {
      const rule: EligibilityRule = { type: 'institution', params: { institutionId: 'unam' } };
      expect(failuresOf([rule], candidate(player()))).toEqual([['u1', 'institution_not_verified']]);
      expect(
        failuresOf(
          [rule],
          candidate(player({ institution: { id: 'unam', email: 'a@unam.mx', verified: false } })),
        ),
      ).toEqual([['u1', 'institution_not_verified']]);
    });

    it('needs an institution id or domains', () => {
      expect(() =>
        evaluateEligibility(candidate(), [{ type: 'institution', params: {} }], context),
      ).toThrow(InvalidEligibilityRuleError);
    });
  });

  describe('max_tier_roster', () => {
    const rule: EligibilityRule = { type: 'max_tier_roster', params: { tier: 1 } };

    it('blocks players with an active roster in a restricted tier', () => {
      const pro = player({ rosters: [roster({ tier: 1 })] });
      expect(evaluateEligibility(candidate(pro), [rule], context).failed[0]).toMatchObject({
        reason: 'active_roster_in_restricted_tier',
        details: { tier: 1, tournamentId: 't-other' },
      });
    });

    it('allows lower tiers, past rosters and the entrant itself', () => {
      const ok = player({
        rosters: [
          roster({ tier: 2 }),
          roster({ tier: 1, leftAt: '2026-02-01T00:00:00.000Z' }),
          roster({ tier: 1, entrantId: 'entrant-1' }),
        ],
      });
      expect(failuresOf([rule], candidate(ok))).toEqual([]);
    });
  });

  describe('exclusivity (anti-chapulineo)', () => {
    const scope = (
      s: 'none' | 'tournament' | 'circuit' | 'season',
      cooldownDays?: number,
    ): EligibilityRule => ({
      type: 'exclusivity',
      params: cooldownDays === undefined ? { scope: s } : { scope: s, cooldownDays },
    });

    it('blocks a second entrant in the same tournament', () => {
      const p = player({ rosters: [roster({ tournamentId: 't-flash' })] });
      expect(failuresOf([scope('tournament')], candidate(p))).toEqual([
        ['u1', 'exclusivity_conflict'],
      ]);
      expect(failuresOf([scope('none')], candidate(p))).toEqual([]);
    });

    it('blocks another team in the same season but allows the same team', () => {
      const other = player({ rosters: [roster({ seasonId: 's-2026' })] });
      expect(
        evaluateEligibility(candidate(other), [scope('season')], context).failed[0],
      ).toMatchObject({
        reason: 'exclusivity_conflict',
        details: { scope: 'season', tournamentId: 't-other', entrantId: 'other-entrant' },
      });
      const same = player({ rosters: [roster({ seasonId: 's-2026', teamId: 'team-1' })] });
      expect(failuresOf([scope('season')], candidate(same))).toEqual([]);
      const otherSeason = player({ rosters: [roster({ seasonId: 's-2025' })] });
      expect(failuresOf([scope('season')], candidate(otherSeason))).toEqual([]);
    });

    it('applies circuit scope only to rosters of the same circuit', () => {
      const inCircuit = player({ rosters: [roster({ circuitId: 'c-womens' })] });
      const elsewhere = player({ rosters: [roster({ circuitId: null, seasonId: 's-2026' })] });
      expect(failuresOf([scope('circuit')], candidate(inCircuit))).toEqual([
        ['u1', 'exclusivity_conflict'],
      ]);
      expect(failuresOf([scope('circuit')], candidate(elsewhere))).toEqual([]);
    });

    it('treats ad-hoc entrants (no team) by entrant', () => {
      const p = player({ rosters: [roster({ tournamentId: 't-flash', teamId: null })] });
      expect(
        failuresOf([scope('tournament')], { entrantId: 'entrant-1', teamId: null, players: [p] }),
      ).toEqual([['u1', 'exclusivity_conflict']]);
    });

    it('enforces the leave cooldown within the scope', () => {
      const left = player({
        rosters: [roster({ seasonId: 's-2026', leftAt: '2026-10-20T00:00:00.000Z' })],
      });
      expect(
        evaluateEligibility(candidate(left), [scope('season', 14)], context).failed[0],
      ).toMatchObject({
        reason: 'exclusivity_cooldown',
        details: { scope: 'season', availableAt: '2026-11-03T00:00:00.000Z' },
      });
      expect(failuresOf([scope('season')], candidate(left))).toEqual([]);
      const longAgo = player({
        rosters: [roster({ seasonId: 's-2026', leftAt: '2026-09-01T00:00:00.000Z' })],
      });
      expect(failuresOf([scope('season', 14)], candidate(longAgo))).toEqual([]);
    });
  });

  describe('not_sanctioned', () => {
    const rule: EligibilityRule = { type: 'not_sanctioned' };

    it('fails during an active sanction, with its end', () => {
      const banned = player({
        sanctions: [{ startsAt: '2026-10-01T00:00:00.000Z', endsAt: '2026-12-01T00:00:00.000Z' }],
      });
      expect(evaluateEligibility(candidate(banned), [rule], context).failed[0]).toMatchObject({
        reason: 'sanctioned',
        details: { until: '2026-12-01T00:00:00.000Z' },
      });
      const permanent = player({
        sanctions: [{ startsAt: '2025-01-01T00:00:00.000Z', endsAt: null }],
      });
      expect(evaluateEligibility(candidate(permanent), [rule], context).failed[0]?.details).toEqual(
        { until: 'permanent' },
      );
    });

    it('passes when sanctions are over or not started', () => {
      const p = player({
        sanctions: [
          { startsAt: '2026-01-01T00:00:00.000Z', endsAt: '2026-02-01T00:00:00.000Z' },
          { startsAt: '2026-12-01T00:00:00.000Z', endsAt: null },
        ],
      });
      expect(failuresOf([rule], candidate(p))).toEqual([]);
    });
  });

  describe('rule data validation', () => {
    it('throws a typed error for an unknown rule type', () => {
      expect(() =>
        evaluateEligibility(candidate(), [{ type: 'voice_comms_required' } as never], context),
      ).toThrow(UnknownEligibilityRuleError);
    });

    it.each<[string, unknown]>([
      ['rank_max', { rank: { tier: 'wood' } }],
      ['rank_max', { rank: { tier: 'gold' } }],
      ['rank_max', { rank: { tier: 'master', division: 1 } }],
      ['region', { regions: 'LA1' }],
      ['age_min', { years: -1 }],
      ['peak_rank_max', { rank: { tier: 'gold', division: 1 } }],
      ['gender', { declaredBefore: 'yesterday' }],
      ['exclusivity', { scope: 'galaxy' }],
      ['max_tier_roster', { tier: 4 }],
    ])('rejects invalid params for %s', (type, params) => {
      expect(() => evaluateEligibility(candidate(), [{ type, params } as never], context)).toThrow(
        InvalidEligibilityRuleError,
      );
    });
  });
});

describe('edge cases', () => {
  it('averages apex ranks and rounds into the right tier', () => {
    const rule: EligibilityRule = {
      type: 'rank_max',
      params: { rank: { tier: 'master' } },
      appliesTo: 'team_average',
    };
    const apex = candidate(
      player({ rank: { tier: 'challenger' } }),
      player({ userId: 'u2', rank: { tier: 'grandmaster' } }),
    );
    expect(evaluateEligibility(apex, [rule], context).failed[0]?.details).toEqual({
      average: 'grandmaster',
      max: 'master',
    });
    expect(failuresOf([{ ...rule, params: { rank: { tier: 'challenger' } } }], apex)).toEqual([]);
    expect(failuresOf([rule], { entrantId: null, teamId: null, players: [] })).toEqual([]);
  });

  it('keeps a roster active until its leave date', () => {
    const leaving = player({
      rosters: [roster({ seasonId: 's-2026', leftAt: '2026-11-30T00:00:00.000Z' })],
    });
    expect(
      failuresOf([{ type: 'exclusivity', params: { scope: 'season' } }], candidate(leaving)),
    ).toEqual([['u1', 'exclusivity_conflict']]);
  });

  it('fails rules for missing optional data instead of crashing', () => {
    const bare: PlayerProfile = { userId: 'u9' };
    const rules: EligibilityRule[] = [
      { type: 'riot_account_verified' },
      { type: 'country', params: { countries: ['MX'] } },
      { type: 'ranked_games_min', params: { games: 1 } },
      { type: 'gender', params: { allowed: ['woman'] } },
      { type: 'institution', params: { emailDomains: ['unam.mx'] } },
      { type: 'peak_rank_max', params: { rank: { tier: 'iron', division: 4 }, windowDays: 30 } },
      { type: 'max_tier_roster', params: { tier: 1 } },
      { type: 'exclusivity', params: { scope: 'circuit', cooldownDays: 7 } },
      { type: 'not_sanctioned' },
    ];
    const bareCandidate = { entrantId: null, teamId: null, players: [bare] };
    expect(evaluateEligibility(bareCandidate, rules, context).failed.map((f) => f.reason)).toEqual([
      'riot_account_not_verified',
      'country_not_allowed',
      'ranked_games_below_min',
      'gender_not_declared',
      'institution_not_verified',
    ]);
    const noScope = {
      ...context,
      tournament: { ...context.tournament, seasonId: null, circuitId: null },
    };
    const p = player({ rosters: [roster({ seasonId: 's-2026', circuitId: 'c-womens' })] });
    expect(
      evaluateEligibility(
        candidate(p),
        [{ type: 'exclusivity', params: { scope: 'season' } }],
        noScope,
      ).eligible,
    ).toBe(true);
  });

  it.each<[string, unknown]>([
    ['region', ['LA1']],
    ['institution', { institutionId: 7 }],
    ['account_level_min', { level: 1.5 }],
    ['rank_max', { rank: null }],
  ])('rejects malformed params for %s', (type, params) => {
    expect(() => evaluateEligibility(candidate(), [{ type, params } as never], context)).toThrow(
      InvalidEligibilityRuleError,
    );
  });
});

describe('assertEligible', () => {
  it('throws IneligibleEntrantError with the failures', () => {
    const rules: EligibilityRule[] = [{ type: 'riot_account_verified' }];
    expect(() => {
      assertEligible(candidate(player({ riotAccountVerified: false })), rules, context);
    }).toThrow(IneligibleEntrantError);
    expect(() => {
      assertEligible(candidate(), rules, context);
    }).not.toThrow();
  });
});
