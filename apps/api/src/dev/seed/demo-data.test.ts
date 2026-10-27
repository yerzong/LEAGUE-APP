import {
  CreateTeamRequestSchema,
  StartRiotVerificationRequestSchema,
  TournamentConfigSchema,
  UpdateProfileRequestSchema,
} from '@league/contracts';
import { describe, expect, it } from 'vitest';

import {
  captainOf,
  DEMO_NAME_PREFIX,
  DEMO_PLAYERS,
  DEMO_TEAMS,
  DEMO_TOURNAMENTS,
  isDemoEmail,
  leagueGames,
  membersOf,
} from './demo-data.js';
import { placeholderLogo } from './png.js';

const unique = (values: readonly string[]) => new Set(values).size === values.length;
const ids = {
  seasonId: '0190a0b0-0000-7000-8000-000000000001',
  circuitId: '0190a0b0-0000-7000-8000-000000000002',
};

describe('demo players', () => {
  it('fills 8 teams of 5 + 1 and leaves 6 free agents', () => {
    expect(DEMO_TEAMS).toHaveLength(8);
    DEMO_TEAMS.forEach((_, i) => {
      expect(membersOf(i)).toHaveLength(6);
    });
    expect(DEMO_PLAYERS.filter((p) => p.team === null)).toHaveLength(6);
  });

  it('are all marked as demo and unique', () => {
    expect(DEMO_PLAYERS.every((p) => isDemoEmail(p.email))).toBe(true);
    expect(DEMO_PLAYERS.every((p) => p.username.startsWith('demo_'))).toBe(true);
    expect(unique(DEMO_PLAYERS.map((p) => p.email))).toBe(true);
    expect(unique(DEMO_PLAYERS.map((p) => p.username))).toBe(true);
    expect(unique(DEMO_PLAYERS.map((p) => p.riot.gameName.toLowerCase()))).toBe(true);
  });

  it('pass the same contracts as the forms', () => {
    for (const p of DEMO_PLAYERS) {
      expect(
        UpdateProfileRequestSchema.safeParse({
          displayName: p.displayName,
          username: p.username,
          countryCode: p.countryCode,
          gameRegion: 'la1',
          birthDate: p.birthDate,
          primaryRole: p.primaryRole,
          secondaryRole: p.secondaryRole,
          bio: p.bio ?? '',
        }).success,
      ).toBe(true);
      expect(
        StartRiotVerificationRequestSchema.safeParse({
          gameName: p.riot.gameName,
          tagLine: p.riot.tagLine,
          region: 'la1',
        }).success,
      ).toBe(true);
    }
  });

  it('have varied ranks, with one Master on the Jaguares to test eligibility', () => {
    expect(new Set(DEMO_PLAYERS.map((p) => p.riot.rank.tier)).size).toBeGreaterThanOrEqual(6);
    expect(membersOf(0).some((p) => p.riot.rank.tier === 'master')).toBe(true);
    expect(captainOf(0).riot.rank.tier).not.toBe('master');
  });
});

describe('demo teams and tournaments', () => {
  it('teams are valid, unique and named demo', () => {
    for (const team of DEMO_TEAMS) {
      expect(team.name.startsWith(DEMO_NAME_PREFIX)).toBe(true);
      expect(CreateTeamRequestSchema.safeParse({ ...team, region: 'la1' }).success).toBe(true);
    }
    expect(unique(DEMO_TEAMS.map((t) => t.tag))).toBe(true);
  });

  it('builds a valid configuration for every tournament', () => {
    const now = new Date('2026-10-27T18:00:00Z');
    for (const t of DEMO_TOURNAMENTS) {
      expect(t.name.startsWith(DEMO_NAME_PREFIX)).toBe(true);
      const parsed = TournamentConfigSchema.safeParse(t.config(now, ids));
      expect(parsed.error?.issues ?? []).toEqual([]);
      expect(parsed.data?.basics.name).toBe(t.name);
      expect(t.approved.every((team) => t.teams.includes(team))).toBe(true);
    }
  });

  it('a flash of 8, a league of 6 and an open registration', () => {
    const byKey = Object.fromEntries(DEMO_TOURNAMENTS.map((t) => [t.key, t]));
    expect(byKey.flash?.approved).toHaveLength(8);
    expect(byKey.league?.approved).toHaveLength(6);
    expect(byKey.open?.teams.length).toBeGreaterThan(byKey.open?.approved.length ?? 0);
  });
});

describe('leagueGames', () => {
  it('always gives one team two wins in at most three games', () => {
    for (let a = 0; a < 6; a += 1)
      for (let b = 0; b < 6; b += 1)
        for (let round = 1; round <= 5; round += 1) {
          if (a === b) continue;
          const games = leagueGames(a, b, round);
          const winsA = games.filter((g) => g.winner === 'a').length;
          const winsB = games.length - winsA;
          expect(Math.max(winsA, winsB)).toBe(2);
          expect(games.at(-1)?.winner).toBe(winsA === 2 ? 'a' : 'b');
          expect(games.map((g) => g.number)).toEqual(games.map((_, i) => i + 1));
        }
  });

  it('mostly favors the stronger team, with some upsets', () => {
    const results = [];
    for (let a = 0; a < 6; a += 1)
      for (let b = a + 1; b < 6; b += 1) results.push(leagueGames(a, b, 1).at(-1)?.winner);
    expect(results.filter((w) => w === 'a').length).toBeGreaterThan(results.length / 2);
    expect(results).toContain('b');
  });
});

describe('placeholderLogo', () => {
  it('is a PNG of the given size', () => {
    const png = placeholderLogo(
      [
        [10, 20, 30],
        [200, 210, 220],
      ],
      32,
    );
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
    expect(png.readUInt32BE(16)).toBe(32);
    expect(png.readUInt32BE(20)).toBe(32);
  });
});
