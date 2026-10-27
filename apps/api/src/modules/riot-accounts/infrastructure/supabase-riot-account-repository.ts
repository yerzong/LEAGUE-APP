import type { RiotRank } from '@league/contracts';
import type { Tables } from '@league/db';
import type { RiotRankEntry } from '@league/integrations';

import { ApplicationError, conflict } from '../../../shared/application-error.js';
import {
  assertNoError,
  isUniqueViolation,
  raisedCode,
} from '../../../shared/database/postgres-errors.js';
import type { AdminClient } from '../../../shared/database/supabase-admin.js';
import type {
  NewVerificationAttempt,
  RankSnapshotRecord,
  RiotAccountRepository,
} from '../application/ports.js';
import type { LinkedRiotAccount, VerificationAttempt } from '../domain/riot-account.js';

type AccountRow = Tables<'riot_accounts'>;
type AttemptRow = Tables<'riot_verification_attempts'>;
type SnapshotRow = Tables<'riot_rank_snapshots'>;

const toAttempt = (row: AttemptRow): VerificationAttempt => ({
  id: row.id,
  userId: row.user_id,
  puuid: row.puuid,
  gameName: row.game_name,
  tagLine: row.tag_line,
  region: row.region,
  expectedIconId: row.expected_icon_id,
  status: row.status,
  expiresAt: new Date(row.expires_at),
});

/** Latest snapshot per queue. */
function latestRanks(snapshots: readonly SnapshotRow[]): RiotRank[] {
  const byQueue = new Map<string, SnapshotRow>();
  for (const s of [...snapshots].sort((x, y) => y.captured_at.localeCompare(x.captured_at))) {
    if (!byQueue.has(s.queue)) byQueue.set(s.queue, s);
  }
  return [...byQueue.values()].map((s) => ({
    queue: s.queue,
    tier: s.tier as RiotRank['tier'],
    division: s.division,
    lp: s.lp,
  }));
}

const toAccount = (row: AccountRow, ranks: RiotRank[]): LinkedRiotAccount => ({
  id: row.id,
  userId: row.user_id,
  puuid: row.puuid,
  gameName: row.game_name,
  tagLine: row.tag_line,
  region: row.region,
  summonerLevel: row.summoner_level,
  profileIconId: row.profile_icon_id,
  verifiedAt: new Date(row.verified_at ?? row.created_at),
  ranks,
});

export class SupabaseRiotAccountRepository implements RiotAccountRepository {
  constructor(private readonly db: AdminClient) {}

  async findActiveByUser(userId: string): Promise<LinkedRiotAccount | null> {
    const { data, error } = await this.db
      .from('riot_accounts')
      .select('*, riot_rank_snapshots(*)')
      .eq('user_id', userId)
      .is('unlinked_at', null)
      .eq('is_primary', true)
      .maybeSingle();
    assertNoError(error);
    if (!data) return null;
    const { riot_rank_snapshots: snapshots, ...row } = data;
    return toAccount(row, latestRanks(snapshots));
  }

  async findActiveByUsers(userIds: readonly string[]): Promise<LinkedRiotAccount[]> {
    const { data, error } = await this.db
      .from('riot_accounts')
      .select('*')
      .in('user_id', [...userIds])
      .is('unlinked_at', null)
      .eq('is_primary', true);
    assertNoError(error);
    return (data ?? []).map((row) => toAccount(row, []));
  }

  async rankHistoryOf(accountIds: readonly string[]): Promise<RankSnapshotRecord[]> {
    if (accountIds.length === 0) return [];
    const { data, error } = await this.db
      .from('riot_rank_snapshots')
      .select('*')
      .in('riot_account_id', [...accountIds])
      .order('captured_at', { ascending: false });
    assertNoError(error);
    return (data ?? []).map((s) => ({
      accountId: s.riot_account_id,
      queue: s.queue,
      tier: s.tier as RiotRank['tier'],
      division: s.division,
      wins: s.wins,
      losses: s.losses,
      capturedAt: new Date(s.captured_at),
    }));
  }

  async findOwnerOfPuuid(puuid: string): Promise<string | null> {
    const { data, error } = await this.db
      .from('riot_accounts')
      .select('user_id')
      .eq('puuid', puuid)
      .is('unlinked_at', null)
      .maybeSingle();
    assertNoError(error);
    return data?.user_id ?? null;
  }

  async findPendingAttempt(userId: string): Promise<VerificationAttempt | null> {
    const { data, error } = await this.db
      .from('riot_verification_attempts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle();
    assertNoError(error);
    return data ? toAttempt(data) : null;
  }

  async createAttempt(attempt: NewVerificationAttempt): Promise<VerificationAttempt> {
    const expired = await this.db
      .from('riot_verification_attempts')
      .update({ status: 'expired', failure_reason: 'replaced' })
      .eq('user_id', attempt.userId)
      .eq('status', 'pending');
    assertNoError(expired.error);

    const { data, error } = await this.db
      .from('riot_verification_attempts')
      .insert({
        user_id: attempt.userId,
        method: 'icon',
        puuid: attempt.puuid,
        game_name: attempt.gameName,
        tag_line: attempt.tagLine,
        region: attempt.region,
        expected_icon_id: attempt.expectedIconId,
        expires_at: attempt.expiresAt.toISOString(),
      })
      .select('*')
      .single();
    assertNoError(error);
    return toAttempt(data as AttemptRow);
  }

  async closeAttempt(
    attemptId: string,
    status: 'expired' | 'failed',
    reason: string,
  ): Promise<void> {
    const { error } = await this.db
      .from('riot_verification_attempts')
      .update({ status, failure_reason: reason })
      .eq('id', attemptId)
      .eq('status', 'pending');
    assertNoError(error);
  }

  async linkFromAttempt(
    attemptId: string,
    summoner: { summonerLevel: number; profileIconId: number },
    ranks: readonly RiotRankEntry[],
  ): Promise<void> {
    const { error } = await this.db.rpc('svc_link_riot_account', {
      p_attempt_id: attemptId,
      p_summoner_level: summoner.summonerLevel,
      p_profile_icon_id: summoner.profileIconId,
      p_ranks: ranks.map((r) => ({ ...r })),
    });
    if (isUniqueViolation(error, 'riot_accounts_puuid_active_key'))
      throw conflict('riot_account_taken');
    if (isUniqueViolation(error, 'riot_accounts_primary_per_user_key'))
      throw conflict('riot_account_already_linked');
    if (raisedCode(error) === 'attempt_not_pending')
      throw new ApplicationError('not_found', 'verification_not_found');
    assertNoError(error);
  }

  async unlink(userId: string, reason: string): Promise<void> {
    const { error } = await this.db.rpc('svc_unlink_riot_account', {
      p_user_id: userId,
      p_reason: reason,
    });
    if (raisedCode(error) === 'no_linked_account')
      throw new ApplicationError('not_found', 'no_linked_account');
    assertNoError(error);
  }
}
