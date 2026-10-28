import {
  CreateTeamRequestSchema,
  TournamentConfigSchema,
  UpdateProfileRequestSchema,
} from '@league/contracts';
import { describe, expect, it } from 'vitest';

import { sampleProfile, sampleTeam, sampleTournament } from './samples';

/** Deterministic sequence, so failures can be reproduced. */
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

describe('autofill samples', () => {
  it.each([1, 2, 3, 42, 999])('are valid for the forms (seed %i)', (seed) => {
    const random = seeded(seed);
    expect(
      UpdateProfileRequestSchema.safeParse(sampleProfile(random)).error?.issues,
    ).toBeUndefined();
    expect(CreateTeamRequestSchema.safeParse(sampleTeam(random)).error?.issues).toBeUndefined();
    expect(
      TournamentConfigSchema.safeParse(sampleTournament(new Date('2026-10-27T18:00:00Z'), random))
        .error?.issues,
    ).toBeUndefined();
  });

  it('vary between calls, so they do not collide', () => {
    const random = seeded(7);
    expect(sampleProfile(random).username).not.toBe(sampleProfile(random).username);
    expect(sampleTeam(random).name).not.toBe(sampleTeam(random).name);
  });

  it('schedules the tournament after now', () => {
    const now = new Date('2026-10-27T18:00:00Z');
    const { schedule } = sampleTournament(now);
    expect(Date.parse(schedule.registrationOpensAt ?? '')).toBeGreaterThan(now.getTime());
  });
});
