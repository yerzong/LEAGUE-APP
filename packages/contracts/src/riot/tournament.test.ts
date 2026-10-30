import { describe, expect, it } from 'vitest';

import { RiotCallbackSchema, TournamentCodeSchema } from './tournament.js';

describe('RiotCallbackSchema', () => {
  it('accepts the stub shape (matchId) and the Riot shape (gameId)', () => {
    expect(RiotCallbackSchema.safeParse({ shortCode: 'STUB-1', matchId: 'LA1_1' }).success).toBe(
      true,
    );
    expect(
      RiotCallbackSchema.safeParse({ shortCode: 'ABC', gameId: 4123, region: 'LA1' }).success,
    ).toBe(true);
  });

  it('requires either a matchId or a gameId', () => {
    expect(RiotCallbackSchema.safeParse({ shortCode: 'STUB-1' }).success).toBe(false);
  });
});

describe('TournamentCodeSchema', () => {
  it('validates a code view', () => {
    const parsed = TournamentCodeSchema.parse({
      gameNumber: 1,
      code: 'STUB-500-0001',
      status: 'active',
      teamSize: 5,
      allowedCount: 10,
      generatedAt: '2026-10-30T18:00:00.000Z',
      usedAt: null,
    });
    expect(parsed.status).toBe('active');
  });

  it('rejects a team size out of range', () => {
    expect(
      TournamentCodeSchema.safeParse({
        gameNumber: 1,
        code: 'x',
        status: 'active',
        teamSize: 6,
        allowedCount: 0,
        generatedAt: '2026-10-30T18:00:00.000Z',
        usedAt: null,
      }).success,
    ).toBe(false);
  });
});
