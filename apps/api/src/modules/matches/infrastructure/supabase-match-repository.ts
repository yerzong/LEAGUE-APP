// Postgres adapter of the match ports. Writes go through
// svc_commit_competition (one transaction, optimistic lock on matches).
import type { ReportedGameInput } from '@league/contracts';
import type { SlotSource } from '@league/core';
import type { Json, Tables } from '@league/db';

import { ApplicationError, conflict } from '../../../shared/application-error.js';
import {
  assertNoError,
  isUniqueViolation,
  raisedCode,
} from '../../../shared/database/postgres-errors.js';
import type { AdminClient } from '../../../shared/database/supabase-admin.js';
import type { EvidenceStorage, MatchRepository, StandingRecord } from '../application/ports.js';
import type {
  CompetitionChange,
  DisputeRecord,
  GameRecord,
  MatchRecord,
  ReportRecord,
  RescheduleRecord,
} from '../domain/match.js';

const raisedConflicts = new Set([
  'match_version_conflict',
  'tournament_status_changed',
  'tournament_not_found',
  'dispute_not_open',
  'reschedule_not_open',
]);

function check(error: Parameters<typeof raisedCode>[0]): void {
  const code = raisedCode(error);
  if (code && raisedConflicts.has(code)) throw new ApplicationError('conflict', code);
  assertNoError(error);
}

const date = (v: string | null) => (v ? new Date(v) : null);

const toMatch = (r: Tables<'matches'>): MatchRecord => ({
  id: r.id,
  tournamentId: r.tournament_id,
  phaseId: r.phase_id,
  groupId: r.group_id,
  bracketKey: r.bracket_key,
  round: r.round,
  position: r.position,
  bracketSide: r.bracket_side,
  entrantA: r.entrant_a_id,
  entrantB: r.entrant_b_id,
  sourceA: r.source_a as SlotSource | null,
  sourceB: r.source_b as SlotSource | null,
  nextWinnerId: r.next_match_winner_id,
  nextWinnerSlot: r.next_match_winner_slot,
  nextLoserId: r.next_match_loser_id,
  nextLoserSlot: r.next_match_loser_slot,
  seriesFormat: r.series_format,
  draftMode: r.draft_mode,
  isTiebreaker: r.is_tiebreaker,
  scheduledAt: date(r.scheduled_at),
  originalScheduledAt: date(r.original_scheduled_at),
  checkinOpensAt: date(r.checkin_opens_at),
  checkinClosesAt: date(r.checkin_closes_at),
  status: r.status,
  scoreA: r.score_a,
  scoreB: r.score_b,
  winnerId: r.winner_entrant_id,
  resultSource: r.result_source,
  finalizedAt: date(r.finalized_at),
  disputeDeadline: date(r.dispute_deadline),
  version: r.version,
});

type DisputeRow = Tables<'disputes'> & { dispute_evidence: Tables<'dispute_evidence'>[] };

const toDispute = (d: DisputeRow): DisputeRecord => ({
  id: d.id,
  matchId: d.match_id,
  category: d.category,
  description: d.description,
  status: d.status,
  openedByEntrantId: d.opened_by_entrant_id,
  resolution: d.resolution,
  resolvedAt: date(d.resolved_at),
  createdAt: new Date(d.created_at),
  evidence: [...d.dispute_evidence]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((e) => ({
      id: e.id,
      storagePath: e.storage_path,
      url: e.url,
      note: e.note,
      createdAt: new Date(e.created_at),
    })),
});

const toReschedule = (r: Tables<'reschedule_requests'>): RescheduleRecord => ({
  id: r.id,
  matchId: r.match_id,
  requestedByEntrantId: r.requested_by_entrant_id,
  proposedAt: r.proposed_at.map((v) => new Date(v)),
  chosenAt: date(r.chosen_at),
  reason: r.reason,
  status: r.status,
  createdAt: new Date(r.created_at),
});

export class SupabaseMatchRepository implements MatchRepository {
  constructor(private readonly db: AdminClient) {}

  async matchesOf(tournamentId: string): Promise<MatchRecord[]> {
    const { data, error } = await this.db
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round')
      .order('position');
    check(error);
    return (data ?? []).map(toMatch);
  }

  async find(matchId: string): Promise<MatchRecord | null> {
    const { data, error } = await this.db
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .maybeSingle();
    check(error);
    return data ? toMatch(data) : null;
  }

  async matchesOfEntrants(entrantIds: readonly string[]): Promise<MatchRecord[]> {
    if (entrantIds.length === 0) return [];
    // Ids are UUIDs from our own tables (no user text in the filter).
    const list = entrantIds.join(',');
    const { data, error } = await this.db
      .from('matches')
      .select('*')
      .or(`entrant_a_id.in.(${list}),entrant_b_id.in.(${list})`);
    check(error);
    return (data ?? []).map(toMatch);
  }

  async games(matchIds: readonly string[]): Promise<GameRecord[]> {
    if (matchIds.length === 0) return [];
    const { data, error } = await this.db
      .from('games')
      .select('match_id, game_number, winner_entrant_id')
      .in('match_id', [...matchIds]);
    check(error);
    return (data ?? []).map((g) => ({
      matchId: g.match_id,
      number: g.game_number,
      winnerId: g.winner_entrant_id,
    }));
  }

  async checkins(matchIds: readonly string[]) {
    if (matchIds.length === 0) return [];
    const { data, error } = await this.db
      .from('match_checkins')
      .select('match_id, entrant_id')
      .in('match_id', [...matchIds])
      .order('checked_in_at');
    check(error);
    return (data ?? []).map((c) => ({ matchId: c.match_id, entrantId: c.entrant_id }));
  }

  async reports(matchId: string): Promise<ReportRecord[]> {
    const { data, error } = await this.db
      .from('result_reports')
      .select('*')
      .eq('match_id', matchId)
      .order('submitted_at');
    check(error);
    return (data ?? []).map((r) => ({
      matchId: r.match_id,
      entrantId: r.reported_by_entrant_id,
      userId: r.reported_by_user_id,
      winnerId: r.winner_entrant_id,
      scoreA: r.score_a,
      scoreB: r.score_b,
      games: r.games as unknown as ReportedGameInput[],
      evidencePaths: r.evidence_paths,
      submittedAt: new Date(r.submitted_at),
    }));
  }

  async disputes(matchIds: readonly string[]): Promise<DisputeRecord[]> {
    if (matchIds.length === 0) return [];
    const { data, error } = await this.db
      .from('disputes')
      .select('*, dispute_evidence(*)')
      .in('match_id', [...matchIds])
      .order('created_at');
    check(error);
    return ((data ?? []) as DisputeRow[]).map(toDispute);
  }

  async findDispute(disputeId: string): Promise<DisputeRecord | null> {
    const { data, error } = await this.db
      .from('disputes')
      .select('*, dispute_evidence(*)')
      .eq('id', disputeId)
      .maybeSingle();
    check(error);
    return data ? toDispute(data) : null;
  }

  async reschedules(matchIds: readonly string[]): Promise<RescheduleRecord[]> {
    if (matchIds.length === 0) return [];
    const { data, error } = await this.db
      .from('reschedule_requests')
      .select('*')
      .in('match_id', [...matchIds])
      .order('created_at');
    check(error);
    return (data ?? []).map(toReschedule);
  }

  async findReschedule(requestId: string): Promise<RescheduleRecord | null> {
    const { data, error } = await this.db
      .from('reschedule_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();
    check(error);
    return data ? toReschedule(data) : null;
  }

  async standings(tournamentId: string): Promise<StandingRecord[]> {
    const { data, error } = await this.db
      .from('standings')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('rank');
    check(error);
    return (data ?? []).map((s) => ({
      phaseId: s.phase_id,
      groupId: s.group_id,
      entrantId: s.entrant_id,
      rank: s.rank,
      points: s.points,
      played: s.played,
      wins: s.wins,
      losses: s.losses,
      draws: s.draws,
      gameWins: s.game_wins,
      gameLosses: s.game_losses,
      gameDiff: s.game_diff,
      status: s.status,
      tiebreakDetails: s.tiebreak_details as StandingRecord['tiebreakDetails'],
    }));
  }

  async dueCheckins(now: Date): Promise<{ toOpen: MatchRecord[]; toClose: MatchRecord[] }> {
    const at = now.toISOString();
    const [open, close] = await Promise.all([
      this.db
        .from('matches')
        .select('*')
        .in('status', ['pending', 'scheduled'])
        .lte('checkin_opens_at', at)
        .not('entrant_a_id', 'is', null)
        .not('entrant_b_id', 'is', null)
        .limit(100),
      this.db
        .from('matches')
        .select('*')
        .eq('status', 'checkin')
        .lte('checkin_closes_at', at)
        .limit(100),
    ]);
    check(open.error);
    check(close.error);
    return { toOpen: (open.data ?? []).map(toMatch), toClose: (close.data ?? []).map(toMatch) };
  }

  async commit(
    tournamentId: string,
    actorId: string | null,
    change: CompetitionChange,
  ): Promise<void> {
    const { error } = await this.db.rpc('svc_commit_competition', {
      p_tournament_id: tournamentId,
      // The generated type marks it required; SQL accepts null (system actions).
      p_actor: actorId as string,
      p_change: change as unknown as Json,
    });
    if (isUniqueViolation(error, 'match_checkins_match_id_entrant_id_key'))
      throw conflict('already_checked_in');
    if (isUniqueViolation(error, 'disputes_open_key')) throw conflict('dispute_already_open');
    if (isUniqueViolation(error, 'reschedule_requests_open_key'))
      throw conflict('reschedule_already_open');
    check(error);
  }
}

const BUCKET = 'match-evidence';
/** Signed links last an hour: enough to review, not to share around. */
const SIGNED_SECONDS = 3600;

export class SupabaseEvidenceStorage implements EvidenceStorage {
  constructor(private readonly db: AdminClient) {}

  async upload(path: string, bytes: Buffer, contentType: string): Promise<void> {
    const { error } = await this.db.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType, upsert: false });
    if (error) throw new Error('Storage upload failed (match-evidence)');
  }

  async signedUrls(paths: readonly string[]): Promise<Map<string, string>> {
    const { data, error } = await this.db.storage
      .from(BUCKET)
      .createSignedUrls([...paths], SIGNED_SECONDS);
    if (error) return new Map();
    return new Map(
      data.flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [])),
    );
  }
}
