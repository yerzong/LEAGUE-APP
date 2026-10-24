import type {
  MyRiotAccountResponse,
  RiotAccountResponse,
  RiotVerificationResponse,
  StartRiotVerificationRequest,
} from '@league/contracts';
import { RiotApiError, type RiotAccountPort } from '@league/integrations';

import { ApplicationError, conflict, notFound } from '../../../shared/application-error.js';
import type { Clock } from '../../../shared/clock.js';
import {
  VERIFICATION_TTL_MS,
  type IconPicker,
  type LinkedRiotAccount,
  type VerificationAttempt,
} from '../domain/riot-account.js';
import type { RiotAccountRepository } from './ports.js';

/** Riot failures become application errors; nothing from Riot's response is forwarded. */
async function callRiot<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof RiotApiError) {
      if (error.kind === 'rate_limited')
        throw new ApplicationError('rate_limited', 'riot_rate_limited');
      if (error.kind === 'not_found') throw notFound('riot_id_not_found');
      throw new ApplicationError('unavailable', 'riot_unavailable');
    }
    throw error;
  }
}

export function toAttemptResponse(attempt: VerificationAttempt): RiotVerificationResponse {
  return {
    id: attempt.id,
    gameName: attempt.gameName,
    tagLine: attempt.tagLine,
    region: attempt.region,
    expectedIconId: attempt.expectedIconId,
    expiresAt: attempt.expiresAt.toISOString(),
    status: attempt.status,
  };
}

export function toAccountResponse(account: LinkedRiotAccount): RiotAccountResponse {
  return {
    gameName: account.gameName,
    tagLine: account.tagLine,
    region: account.region,
    summonerLevel: account.summonerLevel,
    profileIconId: account.profileIconId,
    verifiedAt: account.verifiedAt.toISOString(),
    ranks: [...account.ranks],
  };
}

export class StartRiotVerificationUseCase {
  constructor(
    private readonly repository: RiotAccountRepository,
    private readonly riot: RiotAccountPort,
    private readonly icons: IconPicker,
    private readonly clock: Clock,
  ) {}

  async execute(
    userId: string,
    input: StartRiotVerificationRequest,
  ): Promise<RiotVerificationResponse> {
    if (await this.repository.findActiveByUser(userId))
      throw conflict('riot_account_already_linked');

    const identity = await callRiot(() =>
      this.riot.findAccountByRiotId(input.gameName, input.tagLine, input.region),
    );
    if (!identity) throw notFound('riot_id_not_found');
    if (await this.repository.findOwnerOfPuuid(identity.puuid))
      throw conflict('riot_account_taken');

    const summoner = await callRiot(() => this.riot.getSummoner(identity.puuid, input.region));
    const attempt = await this.repository.createAttempt({
      userId,
      puuid: identity.puuid,
      // Riot's capitalization is the canonical one.
      gameName: identity.gameName,
      tagLine: identity.tagLine,
      region: input.region,
      expectedIconId: this.icons.pick(summoner.profileIconId),
      expiresAt: new Date(this.clock.now().getTime() + VERIFICATION_TTL_MS),
    });
    return toAttemptResponse(attempt);
  }
}

export class ConfirmRiotVerificationUseCase {
  constructor(
    private readonly repository: RiotAccountRepository,
    private readonly riot: RiotAccountPort,
    private readonly clock: Clock,
  ) {}

  async execute(userId: string, attemptId: string): Promise<RiotAccountResponse> {
    const attempt = await this.repository.findPendingAttempt(userId);
    if (attempt?.id !== attemptId) throw notFound('verification_not_found');

    if (this.clock.now() > attempt.expiresAt) {
      await this.repository.closeAttempt(attempt.id, 'expired', 'timeout');
      throw conflict('verification_expired');
    }

    const summoner = await callRiot(() => this.riot.getSummoner(attempt.puuid, attempt.region));
    if (summoner.profileIconId !== attempt.expectedIconId) {
      throw conflict('icon_mismatch', { expectedIconId: attempt.expectedIconId });
    }

    if (await this.repository.findOwnerOfPuuid(attempt.puuid)) {
      await this.repository.closeAttempt(attempt.id, 'failed', 'riot_account_taken');
      throw conflict('riot_account_taken');
    }

    const ranks = await callRiot(() => this.riot.getRankedEntries(attempt.puuid, attempt.region));
    try {
      await this.repository.linkFromAttempt(attempt.id, summoner, ranks);
    } catch (error) {
      if (error instanceof ApplicationError && error.code === 'riot_account_taken') {
        await this.repository.closeAttempt(attempt.id, 'failed', 'riot_account_taken');
      }
      throw error;
    }

    const account = await this.repository.findActiveByUser(userId);
    if (!account) throw new Error('Linked account not found after linking');
    return toAccountResponse(account);
  }
}

export class GetMyRiotAccountUseCase {
  constructor(
    private readonly repository: RiotAccountRepository,
    private readonly clock: Clock,
  ) {}

  async execute(userId: string): Promise<MyRiotAccountResponse> {
    const [account, attempt] = await Promise.all([
      this.repository.findActiveByUser(userId),
      this.repository.findPendingAttempt(userId),
    ]);
    const pending = attempt && attempt.expiresAt > this.clock.now() ? attempt : null;
    return {
      account: account ? toAccountResponse(account) : null,
      pendingVerification: pending ? toAttemptResponse(pending) : null,
    };
  }
}

export class UnlinkRiotAccountUseCase {
  constructor(private readonly repository: RiotAccountRepository) {}

  /** Sensitive: audited inside the same transaction. */
  execute(userId: string, reason: string): Promise<void> {
    return this.repository.unlink(userId, reason);
  }
}

/** Read API other modules use (identity, teams, public pages). */
export class RiotAccountQueries {
  constructor(private readonly repository: RiotAccountRepository) {}

  async hasVerifiedAccount(userId: string): Promise<boolean> {
    return (await this.repository.findActiveByUser(userId)) !== null;
  }

  /** `Nombre#TAG` of each user with a linked account. */
  async riotIdsOf(userIds: readonly string[]): Promise<Map<string, string>> {
    if (userIds.length === 0) return new Map();
    const accounts = await this.repository.findActiveByUsers(userIds);
    return new Map(accounts.map((a) => [a.userId, `${a.gameName}#${a.tagLine}`]));
  }

  async accountOf(userId: string): Promise<LinkedRiotAccount | null> {
    return this.repository.findActiveByUser(userId);
  }
}
