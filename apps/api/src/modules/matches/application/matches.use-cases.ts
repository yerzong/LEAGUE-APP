// Match use cases: fixtures, check-in, dual report, staff results, disputes.
// packages/core decides (lifecycles, series scoring, report reconciliation,
// bracket advance, standings); the repository applies the unit of work.

import type {
  DisputeEvidenceRequest,
  MatchAction,
  MatchDetail,
  MyMatch,
  OpenDisputeRequest,
  ReportedGameInput,
  ReportResultRequest,
  ResolveDisputeRequest,
  StaffForfeitRequest,
  StaffResultRequest,
} from '@league/contracts';
import {
  checkinOutcome,
  DomainError,
  reconcileReports,
  scoreReport,
  tournamentLifecycle,
  winsNeeded,
  type MatchEvent,
} from '@league/core';

import {
  ApplicationError,
  conflict,
  forbidden,
  notFound,
} from '../../../shared/application-error.js';
import { validateImage, type UploadedImage } from '../../../shared/storage/image.js';
import { mergeChanges, type CompetitionChange, type MatchRecord } from '../domain/match.js';
import type { MatchesDeps } from './deps.js';
import {
  compactUpdates,
  completion,
  generatePhase,
  loadState,
  matchContext,
  PLAYED,
  transitionAll,
  type CompetitionState,
} from './engine.js';
import { buildDetail, toSummary } from './views.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function requireStaff(deps: MatchesDeps, userId: string) {
  if (!(await deps.tournaments.isStaff(userId))) throw forbidden('staff_only');
}

async function loadMatch(deps: MatchesDeps, matchId: string): Promise<MatchRecord> {
  const match = await deps.matches.find(matchId);
  if (!match) throw notFound('match_not_found');
  return match;
}

/** The registration of the match the user acts for (captain, co-captain or solo player). */
async function partyEntrant(
  deps: MatchesDeps,
  userId: string,
  match: MatchRecord,
): Promise<string> {
  const managed = await deps.entrants.managedBy(userId, match.tournamentId);
  const entrant = [match.entrantA, match.entrantB].find((e) => e !== null && managed.has(e));
  if (!entrant) throw forbidden('not_match_party');
  return entrant;
}

const recordIn = (state: CompetitionState, matchId: string) => {
  const record = state.matches.find((m) => m.id === matchId);
  if (!record) throw notFound('match_not_found');
  return record;
};

/** Series score of reported games, as a 409 the captain can read when impossible. */
function scored(match: MatchRecord, games: readonly ReportedGameInput[]) {
  if (!match.entrantA || !match.entrantB) throw conflict('entrants_missing');
  try {
    return scoreReport(match.seriesFormat, match.entrantA, match.entrantB, games);
  } catch (error) {
    if (error instanceof DomainError)
      throw conflict('invalid_report', {
        reason: error.details.reason ?? error.code,
      });
    throw error;
  }
}

const statusUpdate = (
  match: MatchRecord,
  status: MatchRecord['status'],
  extra: Record<string, unknown> = {},
) => ({
  matches_update: [{ id: match.id, version: match.version, set: { status, ...extra } }],
});

const event = (match: MatchRecord, type: string, payload: Record<string, unknown> = {}) => ({
  aggregate_type: 'match',
  aggregate_id: match.id,
  event_type: type,
  payload: { tournament_id: match.tournamentId, ...payload },
});

async function commit(
  deps: MatchesDeps,
  match: MatchRecord,
  actorId: string | null,
  change: CompetitionChange,
) {
  await deps.matches.commit(match.tournamentId, actorId, compactUpdates(change));
}

/** Forfeit of `loser`: the winner takes the series (packages/core lifecycle, then completion). */
function forfeitChange(
  deps: MatchesDeps,
  state: CompetitionState,
  match: MatchRecord,
  loser: string,
  checkedIn: readonly string[],
  source: 'checkin_forfeit' | 'admin_override',
): CompetitionChange {
  const winner = loser === match.entrantA ? match.entrantB : match.entrantA;
  if (!winner) throw conflict('entrants_missing');
  const events: MatchEvent[] = match.status === 'pending' ? [{ type: 'schedule' }] : [];
  transitionAll(
    match.status,
    [...events, { type: 'forfeit', entrantId: loser }],
    matchContext(match, checkedIn),
  );
  const target = winsNeeded(match.seriesFormat);
  return completion(
    deps,
    state,
    match,
    {
      winner,
      scoreA: winner === match.entrantA ? target : 0,
      scoreB: winner === match.entrantB ? target : 0,
      forfeit: true,
    },
    { source, games: null },
  );
}

/** Opens the check-in window (scheduling an unscheduled match first). */
function openCheckinChange(match: MatchRecord, now: Date): CompetitionChange {
  const events: MatchEvent[] =
    match.status === 'pending'
      ? [{ type: 'schedule' }, { type: 'open_checkin' }]
      : [{ type: 'open_checkin' }];
  const status = transitionAll(match.status, events, matchContext(match, []));
  return {
    ...statusUpdate(
      match,
      status,
      match.checkinOpensAt ? {} : { checkin_opens_at: now.toISOString() },
    ),
    events: [event(match, 'match.checkin_opened')],
  };
}

/** Closes the check-in: ready, forfeit of whoever is missing, or a no-show for staff. */
function closeCheckinChange(
  deps: MatchesDeps,
  state: CompetitionState,
  match: MatchRecord,
  checkedIn: readonly string[],
): CompetitionChange {
  if (match.status !== 'checkin') throw conflict('checkin_closed');
  if (!match.entrantA || !match.entrantB) throw conflict('entrants_missing');
  const outcome = checkinOutcome(match.entrantA, match.entrantB, checkedIn);
  switch (outcome.kind) {
    case 'ready':
      return {
        ...statusUpdate(
          match,
          transitionAll(
            match.status,
            [{ type: 'checkin_complete' }],
            matchContext(match, checkedIn),
          ),
        ),
        events: [event(match, 'match.ready')],
      };
    case 'forfeit':
      return forfeitChange(deps, state, match, outcome.loser, checkedIn, 'checkin_forfeit');
    case 'no_show':
      // Nobody came: the window stays closed and staff decides.
      return {
        matches_update: [
          { id: match.id, version: match.version, set: { checkin_closes_at: null } },
        ],
        events: [event(match, 'match.no_show')],
      };
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

export class GenerateFixturesUseCase {
  constructor(private readonly deps: MatchesDeps) {}

  /** Registration closed → seeding → in progress, with the first phase generated by core. */
  async execute(userId: string, tournamentId: string): Promise<void> {
    await requireStaff(this.deps, userId);
    const state = await loadState(this.deps, tournamentId);
    const entrants = (await this.deps.entrants.entrantsOf(tournamentId)).filter(
      (e) => e.status === 'approved',
    );
    const context = {
      phaseCount: state.phases.length,
      approvedEntrants: entrants.length,
      minEntrants: 2,
      allPhasesCompleted: false,
    };
    const seeding = tournamentLifecycle.transition(
      state.tournament.status,
      { type: 'start_seeding' },
      context,
    );
    const to = tournamentLifecycle.transition(seeding, { type: 'start' }, context);
    if (entrants.some((e) => e.seed === null)) throw conflict('seeding_required');
    const [first] = state.phases;
    if (!first) throw conflict('no_phases');

    const seeds = entrants
      .map((e) => ({ id: e.id, seed: e.seed ?? 0 }))
      .sort((a, b) => a.seed - b.seed);
    const change = mergeChanges(generatePhase(this.deps, state, first, seeds), {
      tournament_transition: { from: state.tournament.status, to },
      audits: [
        {
          action: 'tournament.started',
          entity_type: 'tournament',
          entity_id: tournamentId,
          before: { status: state.tournament.status },
          after: { status: to },
        },
      ],
      events: [
        {
          aggregate_type: 'tournament',
          aggregate_id: tournamentId,
          event_type: 'tournament.started',
        },
        {
          aggregate_type: 'tournament',
          aggregate_id: tournamentId,
          event_type: 'tournament.fixtures_generated',
          payload: { phase_id: first.id },
        },
      ],
    });
    await this.deps.matches.commit(tournamentId, userId, compactUpdates(change));
  }
}

// ---------------------------------------------------------------------------
// Check-in
// ---------------------------------------------------------------------------

export class RunMatchActionUseCase {
  constructor(private readonly deps: MatchesDeps) {}

  async execute(userId: string, matchId: string, action: MatchAction): Promise<MatchDetail> {
    await requireStaff(this.deps, userId);
    const match = await loadMatch(this.deps, matchId);
    if (action === 'open_checkin') {
      await commit(this.deps, match, userId, openCheckinChange(match, this.deps.clock.now()));
    } else {
      const state = await loadState(this.deps, match.tournamentId);
      const checkins = await this.deps.matches.checkins([match.id]);
      await commit(
        this.deps,
        match,
        userId,
        closeCheckinChange(
          this.deps,
          state,
          recordIn(state, match.id),
          checkins.map((c) => c.entrantId),
        ),
      );
    }
    return buildDetail(this.deps, await loadMatch(this.deps, matchId), userId);
  }
}

export class CheckInUseCase {
  constructor(private readonly deps: MatchesDeps) {}

  async execute(userId: string, matchId: string): Promise<MatchDetail> {
    const match = await loadMatch(this.deps, matchId);
    const entrant = await partyEntrant(this.deps, userId, match);
    if (match.status !== 'checkin') throw conflict('checkin_closed');
    const checkedIn = (await this.deps.matches.checkins([match.id])).map((c) => c.entrantId);
    if (checkedIn.includes(entrant)) throw conflict('already_checked_in');
    const all = [...checkedIn, entrant];
    const both = all.includes(match.entrantA ?? '') && all.includes(match.entrantB ?? '');
    await commit(
      this.deps,
      match,
      userId,
      mergeChanges(
        {
          checkins_insert: [
            { match_id: match.id, entrant_id: entrant, user_id: userId, method: 'web' },
          ],
          events: [event(match, 'match.checked_in', { entrant_id: entrant })],
        },
        both
          ? {
              ...statusUpdate(
                match,
                transitionAll(
                  match.status,
                  [{ type: 'checkin_complete' }],
                  matchContext(match, all),
                ),
              ),
              events: [event(match, 'match.ready')],
            }
          : {},
      ),
    );
    return buildDetail(this.deps, await loadMatch(this.deps, matchId), userId);
  }
}

/** Opens and closes check-in windows on schedule (run every minute by the module). */
export class CheckinSweepUseCase {
  constructor(private readonly deps: MatchesDeps) {}

  async execute(): Promise<{ opened: number; closed: number }> {
    const now = this.deps.clock.now();
    const { toOpen, toClose } = await this.deps.matches.dueCheckins(now);
    let opened = 0;
    let closed = 0;
    for (const match of toOpen) {
      if (await this.attempt(() => commit(this.deps, match, null, openCheckinChange(match, now))))
        opened += 1;
    }
    for (const match of toClose) {
      const done = await this.attempt(async () => {
        const state = await loadState(this.deps, match.tournamentId);
        const checkins = await this.deps.matches.checkins([match.id]);
        await commit(
          this.deps,
          match,
          null,
          closeCheckinChange(
            this.deps,
            state,
            recordIn(state, match.id),
            checkins.map((c) => c.entrantId),
          ),
        );
      });
      if (done) closed += 1;
    }
    return { opened, closed };
  }

  /** A match that changed meanwhile is retried on the next sweep. */
  private async attempt(run: () => Promise<void>): Promise<boolean> {
    try {
      await run();
      return true;
    } catch (error) {
      if (error instanceof ApplicationError || error instanceof DomainError) return false;
      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

const REPORTABLE = new Set(['ready', 'live', 'awaiting_result']);

export class ReportResultUseCase {
  constructor(private readonly deps: MatchesDeps) {}

  /** Dual report (docs/13 §8): matching reports confirm, different ones open a dispute. */
  async execute(userId: string, matchId: string, input: ReportResultRequest): Promise<MatchDetail> {
    const match = await loadMatch(this.deps, matchId);
    const entrant = await partyEntrant(this.deps, userId, match);
    if (!REPORTABLE.has(match.status)) throw conflict('report_closed');
    if (input.evidencePaths.some((p) => !p.startsWith(`${match.id}/`)))
      throw conflict('invalid_evidence');
    const outcome = scored(match, input.games);
    const reports = await this.deps.matches.reports(match.id);
    const reconciliation = reconcileReports(
      match.seriesFormat,
      match.entrantA ?? '',
      match.entrantB ?? '',
      [
        ...reports.map((r) => ({ entrantId: r.entrantId, games: r.games })),
        { entrantId: entrant, games: input.games },
      ],
    );
    const checkedIn = (await this.deps.matches.checkins([match.id])).map((c) => c.entrantId);
    const context = matchContext(match, checkedIn, outcome.winner);
    const toAwaiting: MatchEvent[] =
      match.status === 'ready'
        ? [{ type: 'go_live' }, { type: 'finish_games' }]
        : match.status === 'live'
          ? [{ type: 'finish_games' }]
          : [];
    const awaiting = transitionAll(match.status, toAwaiting, context);

    const report: CompetitionChange = {
      reports_insert: [
        {
          match_id: match.id,
          reported_by_entrant_id: entrant,
          reported_by_user_id: userId,
          winner_entrant_id: outcome.winner,
          score_a: outcome.scoreA,
          score_b: outcome.scoreB,
          games: input.games,
          evidence_paths: input.evidencePaths,
        },
      ],
      events: [event(match, 'match.result_reported', { entrant_id: entrant })],
    };
    const state = await loadState(this.deps, match.tournamentId);
    // Referee and broadcast supervision: staff confirms even matching reports.
    const autoConfirm = ['automatic', 'dual_report'].includes(
      state.tournament.config.supervision.level,
    );

    let next: CompetitionChange;
    if (reconciliation.status === 'agreed' && autoConfirm) {
      transitionAll(awaiting, [{ type: 'confirm_result' }], context);
      next = completion(
        this.deps,
        state,
        recordIn(state, match.id),
        {
          winner: reconciliation.outcome.winner ?? outcome.winner ?? '',
          scoreA: reconciliation.outcome.scoreA,
          scoreB: reconciliation.outcome.scoreB,
        },
        { source: 'dual_report', games: reconciliation.games },
      );
    } else if (reconciliation.status === 'disputed') {
      const status = transitionAll(
        awaiting,
        [{ type: 'dispute', at: this.deps.clock.now().toISOString() }],
        context,
      );
      next = {
        ...statusUpdate(match, status),
        disputes_insert: [
          {
            match_id: match.id,
            category: 'result',
            description: `reports_mismatch:${reconciliation.reason}`,
          },
        ],
        events: [event(match, 'match.disputed', { reason: reconciliation.reason })],
      };
    } else {
      next = statusUpdate(match, awaiting);
    }
    await commit(this.deps, match, userId, mergeChanges(report, next));
    return buildDetail(this.deps, await loadMatch(this.deps, matchId), userId);
  }
}

export class UploadEvidenceUseCase {
  constructor(private readonly deps: MatchesDeps) {}

  async execute(
    userId: string,
    matchId: string,
    file: UploadedImage | undefined,
  ): Promise<{ path: string }> {
    const match = await loadMatch(this.deps, matchId);
    if (!(await this.deps.tournaments.isStaff(userId)))
      await partyEntrant(this.deps, userId, match);
    const image = validateImage(file);
    const path = `${match.id}/${this.deps.newId()}.${image.extension}`;
    await this.deps.evidence.upload(path, image.bytes, image.type);
    return { path };
  }
}

const CONFIRMABLE = new Set(['ready', 'live', 'awaiting_result', 'disputed', 'completed']);

/** Staff (referee) confirms or corrects a result; a correction of a completed match is an override. */
async function staffResultChange(
  deps: MatchesDeps,
  match: MatchRecord,
  games: readonly ReportedGameInput[],
): Promise<{ change: CompetitionChange; override: boolean }> {
  if (!CONFIRMABLE.has(match.status)) throw conflict('result_closed');
  const outcome = scored(match, games);
  const state = await loadState(deps, match.tournamentId);
  const record = recordIn(state, match.id);
  const override = match.status === 'completed' || match.status === 'disputed';
  if (override) {
    const phase = state.phases.find((p) => p.id === match.phaseId);
    if (phase?.status === 'completed') throw conflict('phase_closed');
    const dependents = state.matches.filter(
      (m) => (m.id === match.nextWinnerId || m.id === match.nextLoserId) && PLAYED.has(m.status),
    );
    if (dependents.length > 0) throw conflict('bracket_already_advanced');
  } else {
    const checkedIn = (await deps.matches.checkins([match.id])).map((c) => c.entrantId);
    const events: MatchEvent[] =
      match.status === 'ready'
        ? [{ type: 'go_live' }, { type: 'finish_games' }, { type: 'confirm_result' }]
        : match.status === 'live'
          ? [{ type: 'finish_games' }, { type: 'confirm_result' }]
          : [{ type: 'confirm_result' }];
    transitionAll(match.status, events, matchContext(match, checkedIn, outcome.winner));
  }
  return {
    change: completion(
      deps,
      state,
      record,
      { winner: outcome.winner ?? '', scoreA: outcome.scoreA, scoreB: outcome.scoreB },
      { source: override ? 'admin_override' : 'referee', games },
    ),
    override,
  };
}

export class StaffResultUseCase {
  constructor(private readonly deps: MatchesDeps) {}

  async execute(userId: string, matchId: string, input: StaffResultRequest): Promise<MatchDetail> {
    await requireStaff(this.deps, userId);
    const match = await loadMatch(this.deps, matchId);
    const { change, override } = await staffResultChange(this.deps, match, input.games);
    const open = (await this.deps.matches.disputes([match.id])).filter(
      (d) => d.status === 'open' || d.status === 'under_review',
    );
    await commit(
      this.deps,
      match,
      userId,
      mergeChanges(change, {
        disputes_update: open.map((d) => ({
          id: d.id,
          set: {
            status: 'resolved',
            resolution: input.reason,
            resolved_by: userId,
            resolved_at: this.deps.clock.now().toISOString(),
          },
        })),
        audits: [
          {
            action: override ? 'match.result.override' : 'match.result.confirmed',
            entity_type: 'match',
            entity_id: match.id,
            before: {
              status: match.status,
              winner: match.winnerId,
              score: [match.scoreA, match.scoreB],
            },
            after: { games: input.games },
            reason: input.reason,
          },
        ],
      }),
    );
    return buildDetail(this.deps, await loadMatch(this.deps, matchId), userId);
  }
}

export class StaffForfeitUseCase {
  constructor(private readonly deps: MatchesDeps) {}

  async execute(userId: string, matchId: string, input: StaffForfeitRequest): Promise<MatchDetail> {
    await requireStaff(this.deps, userId);
    const match = await loadMatch(this.deps, matchId);
    const loser = input.loser === 'a' ? match.entrantA : match.entrantB;
    if (!loser) throw conflict('entrants_missing');
    const state = await loadState(this.deps, match.tournamentId);
    const checkedIn = (await this.deps.matches.checkins([match.id])).map((c) => c.entrantId);
    const change = forfeitChange(
      this.deps,
      state,
      recordIn(state, match.id),
      loser,
      checkedIn,
      'admin_override',
    );
    await commit(
      this.deps,
      match,
      userId,
      mergeChanges(change, {
        audits: [
          {
            action: 'match.forfeited',
            entity_type: 'match',
            entity_id: match.id,
            before: { status: match.status },
            after: { loser },
            reason: input.reason,
          },
        ],
      }),
    );
    return buildDetail(this.deps, await loadMatch(this.deps, matchId), userId);
  }
}

// ---------------------------------------------------------------------------
// Disputes
// ---------------------------------------------------------------------------

export class OpenDisputeUseCase {
  constructor(private readonly deps: MatchesDeps) {}

  /** Inside the dispute window after the result, or while it awaits confirmation. */
  async execute(userId: string, matchId: string, input: OpenDisputeRequest): Promise<MatchDetail> {
    const match = await loadMatch(this.deps, matchId);
    const entrant = await partyEntrant(this.deps, userId, match);
    const status = transitionAll(
      match.status,
      [{ type: 'dispute', at: this.deps.clock.now().toISOString() }],
      matchContext(match, []),
    );
    await commit(this.deps, match, userId, {
      ...statusUpdate(match, status),
      disputes_insert: [
        {
          match_id: match.id,
          category: input.category,
          description: input.description,
          opened_by_entrant_id: entrant,
          opened_by_user_id: userId,
        },
      ],
      events: [
        event(match, 'dispute.opened', { entrant_id: entrant }),
        event(match, 'match.disputed'),
      ],
    });
    return buildDetail(this.deps, await loadMatch(this.deps, matchId), userId);
  }
}

export class AddDisputeEvidenceUseCase {
  constructor(private readonly deps: MatchesDeps) {}

  async execute(
    userId: string,
    disputeId: string,
    input: DisputeEvidenceRequest,
  ): Promise<MatchDetail> {
    const dispute = await this.deps.matches.findDispute(disputeId);
    if (!dispute) throw notFound('dispute_not_found');
    if (dispute.status !== 'open' && dispute.status !== 'under_review')
      throw conflict('dispute_not_open');
    const match = await loadMatch(this.deps, dispute.matchId);
    if (!(await this.deps.tournaments.isStaff(userId)))
      await partyEntrant(this.deps, userId, match);
    if (input.path && !input.path.startsWith(`${match.id}/`)) throw conflict('invalid_evidence');
    await commit(this.deps, match, userId, {
      evidence_insert: [
        {
          dispute_id: dispute.id,
          storage_path: input.path,
          url: input.url,
          note: input.note,
          added_by: userId,
        },
      ],
    });
    return buildDetail(this.deps, await loadMatch(this.deps, match.id), userId);
  }
}

export class ResolveDisputeUseCase {
  constructor(private readonly deps: MatchesDeps) {}

  async execute(
    userId: string,
    disputeId: string,
    input: ResolveDisputeRequest,
  ): Promise<MatchDetail> {
    await requireStaff(this.deps, userId);
    const dispute = await this.deps.matches.findDispute(disputeId);
    if (!dispute) throw notFound('dispute_not_found');
    const match = await loadMatch(this.deps, dispute.matchId);
    const now = this.deps.clock.now().toISOString();
    const closeDispute: CompetitionChange = {
      disputes_update: [
        {
          id: dispute.id,
          set: {
            status: input.outcome === 'reject' ? 'rejected' : 'resolved',
            resolution: input.resolution,
            resolved_by: userId,
            resolved_at: now,
          },
        },
      ],
      audits: [
        {
          action: 'dispute.resolved',
          entity_type: 'match',
          entity_id: match.id,
          after: { outcome: input.outcome, dispute_id: dispute.id },
          reason: input.resolution,
        },
      ],
      events: [
        event(match, 'dispute.resolved', { dispute_id: dispute.id, outcome: input.outcome }),
      ],
    };

    let change: CompetitionChange;
    if (input.outcome === 'override') {
      if (!input.games) throw new ApplicationError('invalid', 'games_required');
      const { change: result } = await staffResultChange(this.deps, match, input.games);
      change = mergeChanges(closeDispute, result, {
        audits: [
          {
            action: 'match.result.override',
            entity_type: 'match',
            entity_id: match.id,
            before: { winner: match.winnerId, score: [match.scoreA, match.scoreB] },
            after: { games: input.games },
            reason: input.resolution,
          },
        ],
      });
    } else if (match.status === 'disputed') {
      // Keep (or dismiss): the previous result stands; without one staff must override.
      if (match.winnerId === null) throw conflict('no_result_to_keep');
      const status = transitionAll(
        match.status,
        [{ type: 'confirm_result' }],
        matchContext(match, []),
      );
      change = mergeChanges(closeDispute, statusUpdate(match, status), {
        events: [
          event(match, 'match.completed', { winner: match.winnerId, source: match.resultSource }),
        ],
      });
    } else {
      change = closeDispute;
    }
    await commit(this.deps, match, userId, change);
    return buildDetail(this.deps, await loadMatch(this.deps, match.id), userId);
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export class GetMatchUseCase {
  constructor(private readonly deps: MatchesDeps) {}

  /** Public view for anyone; reports, disputes and actions for the parties and staff. */
  async execute(viewerId: string | null, matchId: string): Promise<MatchDetail> {
    const match = await loadMatch(this.deps, matchId);
    const tournament = await this.deps.tournaments.findById(match.tournamentId);
    const staff = viewerId ? await this.deps.tournaments.isStaff(viewerId) : false;
    if (
      !tournament ||
      (!staff &&
        (tournament.status === 'draft' || tournament.config.basics.visibility === 'private'))
    )
      throw notFound('match_not_found');
    return buildDetail(this.deps, match, viewerId);
  }
}

const TERMINAL = new Set(['completed', 'forfeit', 'canceled']);

export class ListMyMatchesUseCase {
  constructor(private readonly deps: MatchesDeps) {}

  /** Matches of the registrations the user plays in: upcoming first, then the latest results. */
  async execute(userId: string): Promise<MyMatch[]> {
    const mine = await this.deps.entrants.entrantsOfUser(userId);
    if (mine.length === 0) return [];
    const records = (
      await this.deps.matches.matchesOfEntrants(mine.map((m) => m.entrantId))
    ).filter((m) => m.status !== 'canceled');
    const tournamentIds = [...new Set(records.map((r) => r.tournamentId))];
    const contexts = await Promise.all(
      tournamentIds.map(async (id) => {
        const [tournament, phases, entrants] = await Promise.all([
          this.deps.tournaments.findById(id),
          this.deps.tournaments.phases(id),
          this.deps.entrants.entrantsOf(id),
        ]);
        return [
          id,
          { tournament, phases, entrants: new Map(entrants.map((e) => [e.id, e])) },
        ] as const;
      }),
    );
    const byTournament = new Map(contexts);
    const sortKey = (m: MatchRecord) => m.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const upcoming = records
      .filter((m) => !TERMINAL.has(m.status))
      .sort((a, b) => sortKey(a) - sortKey(b) || a.round - b.round);
    const past = records
      .filter((m) => TERMINAL.has(m.status))
      .sort((a, b) => (b.finalizedAt?.getTime() ?? 0) - (a.finalizedAt?.getTime() ?? 0));
    return [...upcoming, ...past].flatMap((m) => {
      const ctx = byTournament.get(m.tournamentId);
      if (!ctx?.tournament) return [];
      const myEntrantId = mine.find(
        (x) => x.entrantId === m.entrantA || x.entrantId === m.entrantB,
      )?.entrantId;
      if (!myEntrantId) return [];
      return [
        {
          ...toSummary(
            m,
            ctx.phases.find((p) => p.id === m.phaseId),
            ctx.entrants,
            new Map(),
          ),
          tournament: {
            id: ctx.tournament.id,
            slug: ctx.tournament.slug,
            name: ctx.tournament.config.basics.name,
            timezone: ctx.tournament.config.basics.timezone,
          },
          myEntrantId,
        },
      ];
    });
  }
}
