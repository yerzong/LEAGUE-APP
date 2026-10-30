import { describe, expect, it, vi } from 'vitest';

import { RiotApiError } from './ports.js';
import { RiotStubTournamentAdapter } from './stub-tournament-adapter.js';
import { RiotTournamentAdapter } from './riot-tournament-adapter.js';

describe('RiotStubTournamentAdapter', () => {
  it('generates codes with the requested count and remembers the roster', async () => {
    const stub = new RiotStubTournamentAdapter();
    const providerId = await stub.createProvider('la1', 'https://x/callback');
    const tournamentId = await stub.createTournament(providerId, 'Liga');
    const codes = await stub.generateCodes({
      tournamentId,
      count: 1,
      teamSize: 5,
      allowedPuuids: ['p0', 'p1', 'p2', 'p3', 'p4', 'q0', 'q1', 'q2', 'q3', 'q4'],
      mapType: 'SUMMONERS_RIFT',
      pickType: 'TOURNAMENT_DRAFT',
      spectatorType: 'ALL',
      metadata: 'game-1',
    });
    expect(codes).toHaveLength(1);
    expect(stub.allowedOf(codes[0] as string)).toContain('q4');
  });

  it('simulates a result the Match-V5 side can read, with the chosen winner', async () => {
    const stub = new RiotStubTournamentAdapter();
    const t = await stub.createTournament(await stub.createProvider('la1', 'https://x'), 'Liga');
    const [code] = await stub.generateCodes({
      tournamentId: t,
      count: 1,
      teamSize: 1,
      allowedPuuids: ['blue-puuid', 'red-puuid'],
      mapType: 'HOWLING_ABYSS',
      pickType: 'BLIND_PICK',
      spectatorType: 'ALL',
      metadata: 'game-1',
    });
    const callback = stub.simulateResult(code as string, 'red');
    expect(callback.metadata).toBe('game-1');
    expect(callback.shortCode).toBe(code);
    const match = await stub.getMatch(callback.matchId, 'la1');
    expect(match).not.toBeNull();
    const winningTeam = match?.info.teams.find((team) => team.win);
    const redWon = match?.info.participants
      .filter((p) => p.teamId === 200)
      .every((p) => p.teamId === winningTeam?.teamId);
    expect(redWon).toBe(true);
    // The frozen roster PUUIDs are the participants.
    expect(match?.info.participants.map((p) => p.puuid).sort()).toEqual([
      'blue-puuid',
      'red-puuid',
    ]);
  });

  it('throws for an unknown code and returns null for an unknown match', async () => {
    const stub = new RiotStubTournamentAdapter();
    expect(() => stub.simulateResult('nope')).toThrow(/unknown tournament code/);
    expect(await stub.getMatch('LA1_404', 'la1')).toBeNull();
  });
});

function fakeFetch(handler: (url: string, init?: RequestInit) => unknown) {
  return vi.fn((url: string, init?: RequestInit) =>
    Promise.resolve(
      handler(url, init) instanceof Response
        ? (handler(url, init) as Response)
        : Response.json(handler(url, init)),
    ),
  ) as unknown as typeof fetch;
}

describe('RiotTournamentAdapter (real)', () => {
  it('creates a provider, tournament and codes on Tournament-V5', async () => {
    const calls: string[] = [];
    const fetchFn = fakeFetch((url) => {
      calls.push(url);
      if (url.endsWith('/providers')) return 1234;
      if (url.endsWith('/tournaments')) return 5678;
      if (url.includes('/codes')) return ['ABC-1', 'ABC-2'];
      return {};
    });
    const adapter = new RiotTournamentAdapter({ apiKey: 'RGAPI-x', fetch: fetchFn });
    expect(await adapter.createProvider('la1', 'https://x/cb')).toBe(1234);
    expect(await adapter.createTournament(1234, 'Liga')).toBe(5678);
    const codes = await adapter.generateCodes({
      tournamentId: 5678,
      count: 2,
      teamSize: 5,
      allowedPuuids: ['a'],
      mapType: 'SUMMONERS_RIFT',
      pickType: 'TOURNAMENT_DRAFT',
      spectatorType: 'ALL',
      metadata: 'g1',
    });
    expect(codes).toEqual(['ABC-1', 'ABC-2']);
    expect(calls.some((u) => u.includes('/lol/tournament/v5/providers'))).toBe(true);
    expect(calls.some((u) => u.includes('count=2&tournamentId=5678'))).toBe(true);
  });

  it('uses the tournament-stub endpoints when stubApi is set', async () => {
    const calls: string[] = [];
    const fetchFn = fakeFetch((url) => {
      calls.push(url);
      return 1;
    });
    const adapter = new RiotTournamentAdapter({ apiKey: 'k', stubApi: true, fetch: fetchFn });
    await adapter.createProvider('la1', 'https://x');
    expect(calls[0]).toContain('/lol/tournament-stub/v5/providers');
  });

  it('fetches a Match-V5 payload and returns null on 404', async () => {
    const adapter = new RiotTournamentAdapter({
      apiKey: 'k',
      fetch: fakeFetch((url) =>
        url.includes('MISS') ? new Response('', { status: 404 }) : { info: { gameDuration: 1800 } },
      ),
    });
    expect(await adapter.getMatch('LA1_1', 'la1')).not.toBeNull();
    expect(await adapter.getMatch('LA1_MISS', 'la1')).toBeNull();
  });

  it('maps 429 and 401 to RiotApiError', async () => {
    const rate = new RiotTournamentAdapter({
      apiKey: 'k',
      fetch: fakeFetch(() => new Response('', { status: 429 })),
    });
    await expect(rate.createProvider('la1', 'https://x')).rejects.toMatchObject({
      name: 'RiotApiError',
      kind: 'rate_limited',
    });
    const auth = new RiotTournamentAdapter({
      apiKey: 'k',
      fetch: fakeFetch(() => new Response('', { status: 401 })),
    });
    await expect(auth.createTournament(1, 'x')).rejects.toBeInstanceOf(RiotApiError);
  });
});
