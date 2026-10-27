// Test double for MatchRepository: applies the same unit of work as
// svc_commit_competition (optimistic lock, one check-in per registration, one
// open dispute and reschedule per match), also on the tournament double.
import type { MatchStatus, ReportedGameInput, TournamentStatus } from '@league/contracts';

import { ApplicationError } from '../../../shared/application-error.js';
import type { InMemoryTournamentRepository } from '../../tournaments/testing/in-memory-tournament-repository.js';
import type { EvidenceStorage, MatchRepository, StandingRecord } from '../application/ports.js';
import type {
  CompetitionChange,
  DisputeRecord,
  GameRecord,
  MatchRecord,
  ReportRecord,
  RescheduleRecord,
} from '../domain/match.js';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
const raised = (code: string) => new ApplicationError('conflict', code);
const date = (v: unknown) => (typeof v === 'string' ? new Date(v) : null);

export class InMemoryMatchRepository implements MatchRepository {
  readonly matches: Mutable<MatchRecord>[] = [];
  readonly games_: GameRecord[] = [];
  readonly checkins_: { matchId: string; entrantId: string }[] = [];
  readonly reports_: ReportRecord[] = [];
  readonly disputes_: Mutable<DisputeRecord>[] = [];
  readonly reschedules_: Mutable<RescheduleRecord>[] = [];
  readonly standings_: (StandingRecord & { tournamentId: string })[] = [];
  readonly audit: { action: string; entityId: string; reason: string | null }[] = [];
  readonly events: string[] = [];
  private sequence = 0;

  constructor(
    private readonly now: () => Date,
    private readonly tournaments: InMemoryTournamentRepository,
  ) {}

  private id(): string {
    this.sequence += 1;
    return `00000000-0000-4000-e000-${String(this.sequence).padStart(12, '0')}`;
  }

  matchesOf(tournamentId: string): Promise<MatchRecord[]> {
    return Promise.resolve(
      this.matches
        .filter((m) => m.tournamentId === tournamentId)
        .sort((a, b) => a.round - b.round || a.position - b.position)
        .map((m) => ({ ...m })),
    );
  }

  find(matchId: string): Promise<MatchRecord | null> {
    const m = this.matches.find((x) => x.id === matchId);
    return Promise.resolve(m ? { ...m } : null);
  }

  matchesOfEntrants(entrantIds: readonly string[]): Promise<MatchRecord[]> {
    return Promise.resolve(
      this.matches
        .filter(
          (m) =>
            (m.entrantA !== null && entrantIds.includes(m.entrantA)) ||
            (m.entrantB !== null && entrantIds.includes(m.entrantB)),
        )
        .map((m) => ({ ...m })),
    );
  }

  games(matchIds: readonly string[]): Promise<GameRecord[]> {
    return Promise.resolve(this.games_.filter((g) => matchIds.includes(g.matchId)));
  }

  checkins(matchIds: readonly string[]) {
    return Promise.resolve(this.checkins_.filter((c) => matchIds.includes(c.matchId)));
  }

  reports(matchId: string): Promise<ReportRecord[]> {
    return Promise.resolve(this.reports_.filter((r) => r.matchId === matchId));
  }

  disputes(matchIds: readonly string[]): Promise<DisputeRecord[]> {
    return Promise.resolve(
      this.disputes_.filter((d) => matchIds.includes(d.matchId)).map((d) => ({ ...d })),
    );
  }

  findDispute(disputeId: string): Promise<DisputeRecord | null> {
    const d = this.disputes_.find((x) => x.id === disputeId);
    return Promise.resolve(d ? { ...d } : null);
  }

  reschedules(matchIds: readonly string[]): Promise<RescheduleRecord[]> {
    return Promise.resolve(
      this.reschedules_.filter((r) => matchIds.includes(r.matchId)).map((r) => ({ ...r })),
    );
  }

  findReschedule(requestId: string): Promise<RescheduleRecord | null> {
    const r = this.reschedules_.find((x) => x.id === requestId);
    return Promise.resolve(r ? { ...r } : null);
  }

  standings(tournamentId: string): Promise<StandingRecord[]> {
    return Promise.resolve(this.standings_.filter((s) => s.tournamentId === tournamentId));
  }

  dueCheckins(now: Date) {
    const known = (m: MatchRecord) => m.entrantA !== null && m.entrantB !== null;
    return Promise.resolve({
      toOpen: this.matches.filter(
        (m) =>
          (m.status === 'pending' || m.status === 'scheduled') &&
          known(m) &&
          m.checkinOpensAt !== null &&
          m.checkinOpensAt <= now,
      ),
      toClose: this.matches.filter(
        (m) => m.status === 'checkin' && m.checkinClosesAt !== null && m.checkinClosesAt <= now,
      ),
    });
  }

  commit(tournamentId: string, _actorId: string | null, change: CompetitionChange): Promise<void> {
    // Validate first: the database applies all or nothing.
    for (const u of change.matches_update ?? []) {
      const m = this.matches.find((x) => x.id === u.id);
      if (!m || m.version !== u.version) throw raised('match_version_conflict');
    }
    const tournament = this.tournaments.tournaments.find((t) => t.id === tournamentId);
    if (!tournament) throw raised('tournament_not_found');
    if (change.tournament_transition && tournament.status !== change.tournament_transition.from)
      throw raised('tournament_status_changed');
    for (const c of change.checkins_insert ?? []) {
      if (this.checkins_.some((x) => x.matchId === c.match_id && x.entrantId === c.entrant_id))
        throw raised('already_checked_in');
    }
    for (const d of change.disputes_insert ?? []) {
      if (
        this.disputes_.some(
          (x) => x.matchId === d.match_id && ['open', 'under_review'].includes(x.status),
        )
      )
        throw raised('dispute_already_open');
    }

    if (change.tournament_transition)
      tournament.status = change.tournament_transition.to as TournamentStatus;
    for (const p of change.phases_update ?? []) {
      if (p.status) this.tournaments.setPhaseStatus(tournamentId, p.id, p.status as 'pending');
    }
    for (const r of change.matches_insert ?? []) {
      this.matches.push({
        id: r.id as string,
        tournamentId,
        phaseId: r.phase_id as string,
        groupId: (r.group_id as string | null) ?? null,
        bracketKey: r.bracket_key as string,
        round: r.round as number,
        position: r.position as number,
        bracketSide: (r.bracket_side as MatchRecord['bracketSide']) ?? null,
        entrantA: (r.entrant_a_id as string | null) ?? null,
        entrantB: (r.entrant_b_id as string | null) ?? null,
        sourceA: (r.source_a as MatchRecord['sourceA']) ?? null,
        sourceB: (r.source_b as MatchRecord['sourceB']) ?? null,
        nextWinnerId: (r.next_match_winner_id as string | null) ?? null,
        nextWinnerSlot: (r.next_match_winner_slot as MatchRecord['nextWinnerSlot']) ?? null,
        nextLoserId: (r.next_match_loser_id as string | null) ?? null,
        nextLoserSlot: (r.next_match_loser_slot as MatchRecord['nextLoserSlot']) ?? null,
        seriesFormat: r.series_format as MatchRecord['seriesFormat'],
        draftMode: (r.draft_mode as MatchRecord['draftMode'] | undefined) ?? 'standard',
        isTiebreaker: r.is_tiebreaker === true,
        scheduledAt: null,
        originalScheduledAt: null,
        checkinOpensAt: null,
        checkinClosesAt: null,
        status: (r.status as MatchStatus | undefined) ?? 'pending',
        scoreA: (r.score_a as number | undefined) ?? 0,
        scoreB: (r.score_b as number | undefined) ?? 0,
        winnerId: (r.winner_entrant_id as string | null) ?? null,
        resultSource: (r.result_source as MatchRecord['resultSource']) ?? null,
        finalizedAt: date(r.finalized_at),
        disputeDeadline: null,
        version: 1,
      });
    }
    for (const u of change.matches_update ?? []) {
      const m = this.matches.find((x) => x.id === u.id);
      if (!m) continue;
      const s = u.set;
      if (s.status !== undefined) m.status = s.status;
      if ('entrant_a_id' in s) m.entrantA = s.entrant_a_id ?? null;
      if ('entrant_b_id' in s) m.entrantB = s.entrant_b_id ?? null;
      if (s.score_a !== undefined) m.scoreA = s.score_a;
      if (s.score_b !== undefined) m.scoreB = s.score_b;
      if ('winner_entrant_id' in s) m.winnerId = s.winner_entrant_id ?? null;
      if ('result_source' in s) m.resultSource = s.result_source ?? null;
      if ('finalized_at' in s) m.finalizedAt = date(s.finalized_at);
      if ('dispute_deadline' in s) m.disputeDeadline = date(s.dispute_deadline);
      if ('scheduled_at' in s) m.scheduledAt = date(s.scheduled_at);
      if ('original_scheduled_at' in s) m.originalScheduledAt = date(s.original_scheduled_at);
      if ('checkin_opens_at' in s) m.checkinOpensAt = date(s.checkin_opens_at);
      if ('checkin_closes_at' in s) m.checkinClosesAt = date(s.checkin_closes_at);
      m.version += 1;
    }
    for (const g of change.games_replace ?? []) {
      for (let i = this.games_.length - 1; i >= 0; i -= 1)
        if (this.games_[i]?.matchId === g.match_id) this.games_.splice(i, 1);
      for (const game of g.games)
        this.games_.push({
          matchId: g.match_id,
          number: game.game_number as number,
          winnerId: (game.winner_entrant_id as string | null) ?? null,
        });
    }
    for (const s of change.standings_replace ?? []) {
      for (let i = this.standings_.length - 1; i >= 0; i -= 1)
        if (this.standings_[i]?.phaseId === s.phase_id) this.standings_.splice(i, 1);
      for (const row of s.rows)
        this.standings_.push({
          tournamentId,
          phaseId: s.phase_id,
          groupId: row.group_id,
          entrantId: row.entrant_id,
          rank: row.rank,
          points: row.points,
          played: row.played,
          wins: row.wins,
          losses: row.losses,
          draws: row.draws,
          gameWins: row.game_wins,
          gameLosses: row.game_losses,
          gameDiff: row.game_diff,
          status: row.status,
          tiebreakDetails: row.tiebreak_details as StandingRecord['tiebreakDetails'],
        });
    }
    for (const c of change.checkins_insert ?? [])
      this.checkins_.push({ matchId: c.match_id as string, entrantId: c.entrant_id as string });
    for (const r of change.reports_insert ?? [])
      this.reports_.push({
        matchId: r.match_id as string,
        entrantId: r.reported_by_entrant_id as string,
        userId: r.reported_by_user_id as string,
        winnerId: r.winner_entrant_id as string,
        scoreA: r.score_a as number,
        scoreB: r.score_b as number,
        games: r.games as ReportedGameInput[],
        evidencePaths: (r.evidence_paths as string[] | undefined) ?? [],
        submittedAt: this.now(),
      });
    for (const d of change.disputes_insert ?? [])
      this.disputes_.push({
        id: (d.id as string | undefined) ?? this.id(),
        matchId: d.match_id as string,
        category: (d.category as DisputeRecord['category'] | undefined) ?? 'result',
        description: d.description as string,
        status: 'open',
        openedByEntrantId: (d.opened_by_entrant_id as string | null | undefined) ?? null,
        resolution: null,
        resolvedAt: null,
        createdAt: this.now(),
        evidence: [],
      });
    for (const u of change.disputes_update ?? []) {
      const d = this.disputes_.find(
        (x) => x.id === u.id && ['open', 'under_review'].includes(x.status),
      );
      if (!d) throw raised('dispute_not_open');
      if (u.set.status) d.status = u.set.status as DisputeRecord['status'];
      if (u.set.resolution) d.resolution = u.set.resolution as string;
      if (u.set.resolved_at) d.resolvedAt = new Date(u.set.resolved_at as string);
    }
    for (const e of change.evidence_insert ?? []) {
      const d = this.disputes_.find((x) => x.id === e.dispute_id);
      if (d)
        d.evidence = [
          ...d.evidence,
          {
            id: this.id(),
            storagePath: (e.storage_path as string | null) ?? null,
            url: (e.url as string | null) ?? null,
            note: (e.note as string | null) ?? null,
            createdAt: this.now(),
          },
        ];
    }
    for (const r of change.reschedules_insert ?? []) {
      if (
        this.reschedules_.some(
          (x) => x.matchId === r.match_id && ['pending', 'accepted'].includes(x.status),
        )
      )
        throw raised('reschedule_already_open');
      this.reschedules_.push({
        id: this.id(),
        matchId: r.match_id as string,
        requestedByEntrantId: r.requested_by_entrant_id as string,
        proposedAt: (r.proposed_at as string[]).map((v) => new Date(v)),
        chosenAt: null,
        reason: (r.reason as string | null) ?? null,
        status: 'pending',
        createdAt: this.now(),
      });
    }
    for (const u of change.reschedules_update ?? []) {
      const r = this.reschedules_.find(
        (x) => x.id === u.id && ['pending', 'accepted'].includes(x.status),
      );
      if (!r) throw raised('reschedule_not_open');
      if (u.set.status) r.status = u.set.status as RescheduleRecord['status'];
      if (u.set.chosen_at) r.chosenAt = new Date(u.set.chosen_at as string);
    }
    for (const a of change.audits ?? [])
      this.audit.push({ action: a.action, entityId: a.entity_id, reason: a.reason ?? null });
    for (const e of change.events ?? []) this.events.push(e.event_type);
    return Promise.resolve();
  }
}

export class FakeEvidenceStorage implements EvidenceStorage {
  readonly files = new Map<string, number>();

  upload(path: string, bytes: Buffer): Promise<void> {
    this.files.set(path, bytes.length);
    return Promise.resolve();
  }

  signedUrls(paths: readonly string[]): Promise<Map<string, string>> {
    return Promise.resolve(new Map(paths.map((p) => [p, `https://storage.test/signed/${p}`])));
  }
}
