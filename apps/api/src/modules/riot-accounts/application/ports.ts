import type { RiotRank } from '@league/contracts';
import type { RiotRankEntry } from '@league/integrations';

import type { LinkedRiotAccount, VerificationAttempt } from '../domain/riot-account.js';

export interface RankSnapshotRecord {
  readonly accountId: string;
  readonly queue: 'solo' | 'flex';
  readonly tier: RiotRank['tier'];
  readonly division: number | null;
  readonly wins: number;
  readonly losses: number;
  readonly capturedAt: Date;
}

export interface NewVerificationAttempt {
  readonly userId: string;
  readonly puuid: string;
  readonly gameName: string;
  readonly tagLine: string;
  readonly region: VerificationAttempt['region'];
  readonly expectedIconId: number;
  readonly expiresAt: Date;
}

export interface RiotAccountRepository {
  findActiveByUser(userId: string): Promise<LinkedRiotAccount | null>;
  findActiveByUsers(userIds: readonly string[]): Promise<LinkedRiotAccount[]>;
  /** Every rank snapshot of the accounts (for peak rank), newest first. */
  rankHistoryOf(accountIds: readonly string[]): Promise<RankSnapshotRecord[]>;
  /** Owner of the active link for this PUUID, if any. */
  findOwnerOfPuuid(puuid: string): Promise<string | null>;
  findPendingAttempt(userId: string): Promise<VerificationAttempt | null>;
  /** Replaces any pending attempt of the user. */
  createAttempt(attempt: NewVerificationAttempt): Promise<VerificationAttempt>;
  closeAttempt(attemptId: string, status: 'expired' | 'failed', reason: string): Promise<void>;
  /** Creates the account, its first rank snapshots and closes the attempt. Throws `riot_account_taken`. */
  linkFromAttempt(
    attemptId: string,
    summoner: { summonerLevel: number; profileIconId: number },
    ranks: readonly RiotRankEntry[],
  ): Promise<void>;
  /** Unlinks and audits. Throws `no_linked_account`. */
  unlink(userId: string, reason: string): Promise<void>;
}

export const RIOT_ACCOUNT_REPOSITORY = Symbol('RiotAccountRepository');
export const RIOT_ACCOUNT_PORT = Symbol('RiotAccountPort');
export const ICON_PICKER = Symbol('IconPicker');
