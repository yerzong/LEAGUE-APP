import { describe, expect, it } from 'vitest';

import {
  DEFAULT_TOURNAMENT_CONFIG,
  defaultPhase,
  EligibilityRuleSchema,
  TournamentConfigSchema,
  type TournamentConfig,
} from './config.js';
import {
  DecideRegistrationRequestSchema,
  RegisterRequestSchema,
  SeedingRequestSchema,
} from './registrations.js';
import { PublicTournamentQuerySchema, UpdateTournamentRequestSchema } from './tournaments.js';

const issuesOf = (config: TournamentConfig) => {
  const result = TournamentConfigSchema.safeParse(config);
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

const USER = '00000000-0000-4000-8000-000000000001';

describe('TournamentConfigSchema', () => {
  it('accepts the default pilot configuration', () => {
    expect(issuesOf(DEFAULT_TOURNAMENT_CONFIG)).toEqual([]);
  });

  it('keeps the roster starters equal to the team size', () => {
    expect(
      issuesOf({
        ...DEFAULT_TOURNAMENT_CONFIG,
        game: { ...DEFAULT_TOURNAMENT_CONFIG.game, teamSize: 2 },
      }),
    ).toEqual(['starters_team_size']);
  });

  it('needs a venue on site and a season for season exclusivity', () => {
    const config: TournamentConfig = {
      ...DEFAULT_TOURNAMENT_CONFIG,
      participants: { ...DEFAULT_TOURNAMENT_CONFIG.participants, modality: 'onsite' },
      eligibility: { ...DEFAULT_TOURNAMENT_CONFIG.eligibility, exclusivityScope: 'season' },
    };
    expect(issuesOf(config)).toEqual(['venue_required', 'season_required']);
  });

  it('orders the registration window before the start', () => {
    const config: TournamentConfig = {
      ...DEFAULT_TOURNAMENT_CONFIG,
      schedule: {
        ...DEFAULT_TOURNAMENT_CONFIG.schedule,
        registrationOpensAt: '2026-11-10T00:00:00.000Z',
        registrationClosesAt: '2026-11-01T00:00:00.000Z',
        startsAt: '2026-10-30T00:00:00.000Z',
      },
    };
    expect(issuesOf(config)).toEqual(['date_order', 'date_order']);
  });

  it('asks every phase but the last for its advancing entrants', () => {
    const groups = { ...defaultPhase('groups', 'Grupos'), advance: null };
    const config: TournamentConfig = {
      ...DEFAULT_TOURNAMENT_CONFIG,
      format: {
        ...DEFAULT_TOURNAMENT_CONFIG.format,
        phases: [groups, { ...defaultPhase('swiss', 'Suizo'), rounds: null }],
      },
    };
    expect(issuesOf(config)).toEqual(['advance_required', 'swiss_rounds']);
  });

  it('requires a placement and a currency for cash prizes', () => {
    const config: TournamentConfig = {
      ...DEFAULT_TOURNAMENT_CONFIG,
      prizes: {
        hasPrizes: true,
        poolSummary: null,
        items: [
          {
            awardType: 'placement',
            placementFrom: null,
            placementTo: null,
            label: null,
            prizeType: 'cash',
            description: null,
            amount: 50000,
            currency: null,
            quantity: 1,
            distribution: 'team',
          },
        ],
      },
    };
    expect(issuesOf(config)).toEqual(['placement_required', 'currency_required']);
  });
});

describe('EligibilityRuleSchema', () => {
  it('validates ranks as packages/core reads them', () => {
    const rank = (tier: string, division?: number) => ({
      type: 'rank_max',
      params: { rank: division === undefined ? { tier } : { tier, division } },
    });
    expect(EligibilityRuleSchema.safeParse(rank('gold', 1)).success).toBe(true);
    expect(EligibilityRuleSchema.safeParse(rank('master')).success).toBe(true);
    expect(EligibilityRuleSchema.safeParse(rank('gold')).success).toBe(false);
    expect(EligibilityRuleSchema.safeParse(rank('master', 1)).success).toBe(false);
  });

  it('does not take exclusivity as a rule (it is the tournament scope)', () => {
    expect(
      EligibilityRuleSchema.safeParse({ type: 'exclusivity', params: { scope: 'season' } }).success,
    ).toBe(false);
    expect(EligibilityRuleSchema.safeParse({ type: 'institution', params: {} }).success).toBe(
      false,
    );
  });
});

describe('requests', () => {
  it('requires accepting the rulebook to register', () => {
    const base = {
      teamId: null,
      roster: [{ userId: USER, role: 'starter' }],
      rulebookVersionId: null,
    };
    expect(RegisterRequestSchema.safeParse({ ...base, acceptRules: true }).success).toBe(true);
    expect(RegisterRequestSchema.safeParse({ ...base, acceptRules: false }).success).toBe(false);
  });

  it('fills defaults for decisions, seeding, updates and public filters', () => {
    expect(DecideRegistrationRequestSchema.parse({ decision: 'approve' })).toEqual({
      decision: 'approve',
      reason: null,
      overrideEligibility: false,
    });
    expect(SeedingRequestSchema.parse({ method: 'rank' })).toEqual({ method: 'rank', seeds: [] });
    expect(
      UpdateTournamentRequestSchema.parse({ config: DEFAULT_TOURNAMENT_CONFIG }),
    ).toMatchObject({
      confirm: false,
      reason: null,
    });
    expect(PublicTournamentQuerySchema.parse({})).toEqual({ status: 'all', page: 1, pageSize: 24 });
  });
});
