// Test double for RiotAccountRepository with the same uniqueness rules as the database.
import type { RiotRankEntry } from '@league/integrations';

import { ApplicationError, conflict } from '../../../shared/application-error.js';
import type { NewVerificationAttempt, RiotAccountRepository } from '../application/ports.js';
import type { LinkedRiotAccount, VerificationAttempt } from '../domain/riot-account.js';

export class InMemoryRiotAccountRepository implements RiotAccountRepository {
  readonly accounts: (LinkedRiotAccount & { unlinkedAt: Date | null })[] = [];
  readonly attempts: (VerificationAttempt & { reason?: string })[] = [];
  readonly audit: { userId: string; action: string; reason: string }[] = [];
  private sequence = 0;

  constructor(private readonly now: () => Date = () => new Date()) {}

  findActiveByUser(userId: string): Promise<LinkedRiotAccount | null> {
    return Promise.resolve(
      this.accounts.find((a) => a.userId === userId && a.unlinkedAt === null) ?? null,
    );
  }

  findActiveByUsers(userIds: readonly string[]): Promise<LinkedRiotAccount[]> {
    return Promise.resolve(
      this.accounts.filter((a) => userIds.includes(a.userId) && a.unlinkedAt === null),
    );
  }

  findOwnerOfPuuid(puuid: string): Promise<string | null> {
    return Promise.resolve(
      this.accounts.find((a) => a.puuid === puuid && a.unlinkedAt === null)?.userId ?? null,
    );
  }

  findPendingAttempt(userId: string): Promise<VerificationAttempt | null> {
    return Promise.resolve(
      this.attempts.find((a) => a.userId === userId && a.status === 'pending') ?? null,
    );
  }

  createAttempt(attempt: NewVerificationAttempt): Promise<VerificationAttempt> {
    for (const [i, a] of this.attempts.entries()) {
      if (a.userId === attempt.userId && a.status === 'pending')
        this.attempts[i] = { ...a, status: 'expired' };
    }
    this.sequence += 1;
    const created: VerificationAttempt = {
      ...attempt,
      id: `00000000-0000-4000-8000-${String(this.sequence).padStart(12, '0')}`,
      status: 'pending',
    };
    this.attempts.push(created);
    return Promise.resolve(created);
  }

  closeAttempt(attemptId: string, status: 'expired' | 'failed', reason: string): Promise<void> {
    const index = this.attempts.findIndex((a) => a.id === attemptId);
    const attempt = this.attempts[index];
    if (attempt) this.attempts[index] = { ...attempt, status, reason };
    return Promise.resolve();
  }

  async linkFromAttempt(
    attemptId: string,
    summoner: { summonerLevel: number; profileIconId: number },
    ranks: readonly RiotRankEntry[],
  ): Promise<void> {
    const index = this.attempts.findIndex((a) => a.id === attemptId && a.status === 'pending');
    const attempt = this.attempts[index];
    if (!attempt) throw new Error('attempt_not_pending');
    if (await this.findOwnerOfPuuid(attempt.puuid)) throw conflict('riot_account_taken');
    this.accounts.push({
      id: `acc-${attempt.id}`,
      userId: attempt.userId,
      puuid: attempt.puuid,
      gameName: attempt.gameName,
      tagLine: attempt.tagLine,
      region: attempt.region,
      summonerLevel: summoner.summonerLevel,
      profileIconId: summoner.profileIconId,
      verifiedAt: this.now(),
      ranks: ranks.map(({ queue, tier, division, lp }) => ({ queue, tier, division, lp })),
      unlinkedAt: null,
    });
    this.attempts[index] = { ...attempt, status: 'verified' };
  }

  unlink(userId: string, reason: string): Promise<void> {
    const index = this.accounts.findIndex((a) => a.userId === userId && a.unlinkedAt === null);
    const account = this.accounts[index];
    if (!account) return Promise.reject(new ApplicationError('not_found', 'no_linked_account'));
    this.accounts[index] = { ...account, unlinkedAt: this.now() };
    this.audit.push({ userId, action: 'riot_account.unlinked', reason });
    return Promise.resolve();
  }
}
