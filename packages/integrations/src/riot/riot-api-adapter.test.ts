import { describe, expect, it } from 'vitest';

import { RiotApiError } from './ports.js';
import { RiotApiAccountAdapter } from './riot-api-adapter.js';
import { StubRiotAccountAdapter } from './stub-riot-account-adapter.js';

type Call = { url: string; headers: Headers };

function fakeFetch(routes: Record<string, { status: number; body?: unknown }>) {
  const calls: Call[] = [];
  const fetchFn: typeof fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, headers: new Headers(init?.headers) });
    const route = routes[url] ?? { status: 404 };
    return Promise.resolve(
      new Response(route.body === undefined ? null : JSON.stringify(route.body), {
        status: route.status,
      }),
    );
  };
  return { fetchFn, calls };
}

const PUUID = 'p-uuid_1';

describe('RiotApiAccountAdapter', () => {
  it('looks a Riot ID up on the americas cluster with the key in a header', async () => {
    const { fetchFn, calls } = fakeFetch({
      'https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Ana%20Mid/LAN': {
        status: 200,
        body: { puuid: PUUID, gameName: 'Ana Mid', tagLine: 'LAN' },
      },
    });
    const adapter = new RiotApiAccountAdapter({ apiKey: 'RGAPI-test', fetch: fetchFn });

    await expect(adapter.findAccountByRiotId('Ana Mid', 'LAN', 'la1')).resolves.toEqual({
      puuid: PUUID,
      gameName: 'Ana Mid',
      tagLine: 'LAN',
    });
    expect(calls[0]?.headers.get('x-riot-token')).toBe('RGAPI-test');
    expect(calls[0]?.url).not.toContain('RGAPI');
  });

  it('returns null for an unknown Riot ID', async () => {
    const adapter = new RiotApiAccountAdapter({ apiKey: 'k', fetch: fakeFetch({}).fetchFn });
    await expect(adapter.findAccountByRiotId('Nobody', 'LAN', 'la1')).resolves.toBeNull();
  });

  it('reads the summoner and the ranked entries on the platform host', async () => {
    const { fetchFn } = fakeFetch({
      [`https://la2.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${PUUID}`]: {
        status: 200,
        body: { profileIconId: 12, summonerLevel: 187, puuid: PUUID },
      },
      [`https://la2.api.riotgames.com/lol/league/v4/entries/by-puuid/${PUUID}`]: {
        status: 200,
        body: [
          {
            queueType: 'RANKED_SOLO_5x5',
            tier: 'EMERALD',
            rank: 'III',
            leaguePoints: 44,
            wins: 30,
            losses: 25,
          },
          {
            queueType: 'RANKED_FLEX_SR',
            tier: 'MASTER',
            rank: 'I',
            leaguePoints: 120,
            wins: 5,
            losses: 1,
          },
          { queueType: 'CHERRY', tier: 'GOLD', rank: 'I', leaguePoints: 0, wins: 0, losses: 0 },
        ],
      },
    });
    const adapter = new RiotApiAccountAdapter({ apiKey: 'k', fetch: fetchFn });

    await expect(adapter.getSummoner(PUUID, 'la2')).resolves.toEqual({
      profileIconId: 12,
      summonerLevel: 187,
    });
    await expect(adapter.getRankedEntries(PUUID, 'la2')).resolves.toEqual([
      { queue: 'solo', tier: 'emerald', division: 3, lp: 44, wins: 30, losses: 25 },
      { queue: 'flex', tier: 'master', division: null, lp: 120, wins: 5, losses: 1 },
    ]);
  });

  it.each([
    [429, 'rate_limited'],
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [503, 'unavailable'],
  ] as const)('maps HTTP %i to a typed error', async (status, kind) => {
    const url = `https://na1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${PUUID}`;
    const adapter = new RiotApiAccountAdapter({
      apiKey: 'k',
      fetch: fakeFetch({ [url]: { status } }).fetchFn,
    });
    await expect(adapter.getSummoner(PUUID, 'na1')).rejects.toEqual(new RiotApiError(kind, status));
  });

  it('maps network failures and malformed bodies to "unavailable"', async () => {
    const failing: typeof fetch = () => Promise.reject(new TypeError('network'));
    await expect(
      new RiotApiAccountAdapter({ apiKey: 'k', fetch: failing }).getSummoner(PUUID, 'la1'),
    ).rejects.toMatchObject({
      kind: 'unavailable',
    });
    const url = `https://la1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${PUUID}`;
    const malformed = fakeFetch({ [url]: { status: 200, body: { profileIconId: 'x' } } }).fetchFn;
    await expect(
      new RiotApiAccountAdapter({ apiKey: 'k', fetch: malformed }).getSummoner(PUUID, 'la1'),
    ).rejects.toMatchObject({
      kind: 'unavailable',
    });
  });
});

describe('StubRiotAccountAdapter', () => {
  it('serves preset accounts and lets tests change the icon', async () => {
    const stub = new StubRiotAccountAdapter({
      accounts: [
        {
          puuid: 'p1',
          gameName: 'Ana',
          tagLine: 'LAN',
          profileIconId: 3,
          summonerLevel: 50,
          ranks: [],
        },
      ],
    });
    await expect(stub.findAccountByRiotId('ana', 'lan', 'la1')).resolves.toMatchObject({
      puuid: 'p1',
    });
    await expect(stub.getSummoner('p1', 'la1')).resolves.toEqual({
      profileIconId: 3,
      summonerLevel: 50,
    });
    stub.setProfileIcon('p1', 9);
    await expect(stub.getSummoner('p1', 'la1')).resolves.toMatchObject({ profileIconId: 9 });
    await expect(stub.findAccountByRiotId('Nobody', 'LAN', 'la1')).resolves.toBeNull();
    await expect(stub.getSummoner('unknown', 'la1')).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('can simulate any Riot ID for local runs and E2E', async () => {
    const stub = new StubRiotAccountAdapter({ generateAccounts: true });
    const account = await stub.findAccountByRiotId('E2E Player', 'TEST', 'la1');
    expect(account).toMatchObject({ gameName: 'E2E Player', tagLine: 'TEST' });
    await expect(stub.findAccountByRiotId('missing-one', 'TEST', 'la1')).resolves.toBeNull();

    // The player "changes the icon" after the first lookup: the next one sees the next icon.
    const puuid = account?.puuid ?? '';
    const before = await stub.getSummoner(puuid, 'la1');
    const after = await stub.getSummoner(puuid, 'la1');
    expect(after.profileIconId).toBe((before.profileIconId + 1) % 29);
    await expect(stub.getRankedEntries(puuid, 'la1')).resolves.toEqual([
      { queue: 'solo', tier: 'gold', division: 2, lp: 50, wins: 20, losses: 18 },
    ]);

    // A Riot ID starting with "mismatch" never changes its icon.
    const stubborn = await stub.findAccountByRiotId('mismatch-icon', 'TEST', 'la1');
    const first = await stub.getSummoner(stubborn?.puuid ?? '', 'la1');
    await expect(stub.getSummoner(stubborn?.puuid ?? '', 'la1')).resolves.toEqual(first);
  });
});
