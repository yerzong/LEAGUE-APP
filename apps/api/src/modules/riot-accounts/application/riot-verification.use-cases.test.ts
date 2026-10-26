import { RiotApiError, StubRiotAccountAdapter, type RiotAccountPort } from '@league/integrations';
import { describe, expect, it } from 'vitest';

import type { Clock } from '../../../shared/clock.js';
import { NextIconPicker, RandomIconPicker } from '../domain/riot-account.js';
import { InMemoryRiotAccountRepository } from '../testing/in-memory-riot-account-repository.js';
import {
  ConfirmRiotVerificationUseCase,
  GetMyRiotAccountUseCase,
  RiotAccountQueries,
  StartRiotVerificationUseCase,
  UnlinkRiotAccountUseCase,
} from './riot-verification.use-cases.js';

const ANA = 'ana-id';
const BETO = 'beto-id';
const anaRiot = { gameName: 'Ana Mid', tagLine: 'LAN', region: 'la1' as const };

function setup() {
  let now = new Date('2026-10-24T12:00:00.000Z');
  const clock: Clock = { now: () => now };
  const riot = new StubRiotAccountAdapter({
    accounts: [
      {
        puuid: 'puuid-ana',
        gameName: 'Ana Mid',
        tagLine: 'LAN',
        profileIconId: 5,
        summonerLevel: 120,
        ranks: [{ queue: 'solo', tier: 'gold', division: 2, lp: 40, wins: 10, losses: 8 }],
      },
    ],
  });
  const repo = new InMemoryRiotAccountRepository(() => now);
  const picker = new NextIconPicker(29);
  return {
    repo,
    riot,
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
    start: new StartRiotVerificationUseCase(repo, riot, picker, clock),
    confirm: new ConfirmRiotVerificationUseCase(repo, riot, clock),
    get: new GetMyRiotAccountUseCase(repo, clock),
    unlink: new UnlinkRiotAccountUseCase(repo),
    queries: new RiotAccountQueries(repo),
  };
}

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return (error as { code?: string }).code;
  }
  return undefined;
}

describe('Riot verification by icon', () => {
  it('asks for an icon different from the current one, valid for 15 minutes', async () => {
    const { start } = setup();
    const attempt = await start.execute(ANA, anaRiot);
    expect(attempt).toMatchObject({ gameName: 'Ana Mid', expectedIconId: 6, status: 'pending' });
    expect(attempt.expiresAt).toBe('2026-10-24T12:15:00.000Z');
  });

  it('links the account when the icon matches, with level and ranks', async () => {
    const { start, confirm, riot, get, queries } = setup();
    const attempt = await start.execute(ANA, anaRiot);
    riot.setProfileIcon('puuid-ana', attempt.expectedIconId);

    const result = await confirm.execute(ANA, attempt.id);
    expect(result).toMatchObject({
      gameName: 'Ana Mid',
      tagLine: 'LAN',
      region: 'la1',
      summonerLevel: 120,
      ranks: [{ queue: 'solo', tier: 'gold', division: 2, lp: 40 }],
    });
    await expect(get.execute(ANA)).resolves.toMatchObject({
      account: { gameName: 'Ana Mid' },
      pendingVerification: null,
    });
    await expect(queries.hasVerifiedAccount(ANA)).resolves.toBe(true);
    await expect(queries.riotIdsOf([ANA, BETO])).resolves.toEqual(new Map([[ANA, 'Ana Mid#LAN']]));
  });

  it('keeps the attempt open while the icon does not match yet', async () => {
    const { start, confirm, get } = setup();
    const attempt = await start.execute(ANA, anaRiot);
    expect(await codeOf(confirm.execute(ANA, attempt.id))).toBe('icon_mismatch');
    await expect(get.execute(ANA)).resolves.toMatchObject({
      account: null,
      pendingVerification: { id: attempt.id },
    });
  });

  it('expires the attempt after 15 minutes', async () => {
    const { start, confirm, riot, advance, repo } = setup();
    const attempt = await start.execute(ANA, anaRiot);
    riot.setProfileIcon('puuid-ana', attempt.expectedIconId);
    advance(15 * 60 * 1000 + 1);
    expect(await codeOf(confirm.execute(ANA, attempt.id))).toBe('verification_expired');
    expect(repo.attempts[0]?.status).toBe('expired');
  });

  it('fails clearly for unknown Riot IDs and foreign attempts', async () => {
    const { start, confirm } = setup();
    expect(await codeOf(start.execute(ANA, { ...anaRiot, gameName: 'Nobody' }))).toBe(
      'riot_id_not_found',
    );
    const attempt = await start.execute(ANA, anaRiot);
    expect(await codeOf(confirm.execute(BETO, attempt.id))).toBe('verification_not_found');
  });

  it('never links a Riot account already linked to another user', async () => {
    const { start, confirm, riot } = setup();
    const first = await start.execute(ANA, anaRiot);
    riot.setProfileIcon('puuid-ana', first.expectedIconId);
    await confirm.execute(ANA, first.id);

    expect(await codeOf(start.execute(BETO, anaRiot))).toBe('riot_account_taken');
    expect(await codeOf(start.execute(ANA, anaRiot))).toBe('riot_account_already_linked');
  });

  it('rejects the link if someone else verified the same account meanwhile', async () => {
    const { start, confirm, riot, repo } = setup();
    const anaAttempt = await start.execute(ANA, anaRiot);
    const betoAttempt = await start.execute(BETO, anaRiot);
    riot.setProfileIcon('puuid-ana', anaAttempt.expectedIconId);
    await confirm.execute(ANA, anaAttempt.id);
    riot.setProfileIcon('puuid-ana', betoAttempt.expectedIconId);
    expect(await codeOf(confirm.execute(BETO, betoAttempt.id))).toBe('riot_account_taken');
    expect(repo.attempts.find((a) => a.id === betoAttempt.id)?.status).toBe('failed');
  });

  it('starting again replaces the pending attempt', async () => {
    const { start, repo } = setup();
    await start.execute(ANA, anaRiot);
    await start.execute(ANA, anaRiot);
    expect(repo.attempts.map((a) => a.status)).toEqual(['expired', 'pending']);
  });

  it('maps Riot outages to a typed error', async () => {
    const { repo } = setup();
    const failing = (kind: 'rate_limited' | 'unavailable'): RiotAccountPort => ({
      findAccountByRiotId: () => Promise.reject(new RiotApiError(kind, null)),
      getSummoner: () => Promise.reject(new RiotApiError(kind, null)),
      getRankedEntries: () => Promise.reject(new RiotApiError(kind, null)),
    });
    const clock = { now: () => new Date() };
    const startWith = (port: RiotAccountPort) =>
      new StartRiotVerificationUseCase(repo, port, new RandomIconPicker(29), clock);
    expect(await codeOf(startWith(failing('rate_limited')).execute(ANA, anaRiot))).toBe(
      'riot_rate_limited',
    );
    expect(await codeOf(startWith(failing('unavailable')).execute(ANA, anaRiot))).toBe(
      'riot_unavailable',
    );
  });

  it('unlinks with a reason and audits it', async () => {
    const { start, confirm, riot, unlink, repo, queries } = setup();
    const attempt = await start.execute(ANA, anaRiot);
    riot.setProfileIcon('puuid-ana', attempt.expectedIconId);
    await confirm.execute(ANA, attempt.id);

    await unlink.execute(ANA, 'Cambié de cuenta principal');
    expect(repo.audit).toEqual([
      { userId: ANA, action: 'riot_account.unlinked', reason: 'Cambié de cuenta principal' },
    ]);
    await expect(queries.hasVerifiedAccount(ANA)).resolves.toBe(false);
    expect(await codeOf(unlink.execute(ANA, 'otra vez sin cuenta'))).toBe('no_linked_account');
  });
});

describe('icon pickers', () => {
  it('never picks the current icon', () => {
    const picker = new RandomIconPicker(29, () => 0);
    expect(picker.pick(0)).toBe(1);
    expect(new RandomIconPicker(29, () => 0.999).pick(28)).toBe(27);
    expect(new NextIconPicker(29).pick(28)).toBe(0);
  });
});
