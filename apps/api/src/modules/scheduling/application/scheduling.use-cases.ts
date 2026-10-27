// Calendar of the matches (docs/14 §3.1 paso 6, docs/13 §9): automatic
// placement in the schedule windows, manual times, and reschedule requests
// between captains approved by staff. Windows are evaluated by packages/core.

import type {
  DecideRescheduleRequest,
  MatchDetail,
  RescheduleRequest,
  RespondRescheduleRequest,
  SetScheduleRequest,
} from '@league/contracts';
import { autoSchedule, checkinWindow, isWithinWindows, matchLifecycle } from '@league/core';

import {
  ApplicationError,
  conflict,
  forbidden,
  notFound,
} from '../../../shared/application-error.js';
import type { MatchesDeps } from '../../matches/application/deps.js';
import { compactUpdates, loadState } from '../../matches/application/engine.js';
import { buildDetail } from '../../matches/application/views.js';
import type { CompetitionChange, MatchRecord } from '../../matches/domain/match.js';
import type { TournamentRecord } from '../../tournaments/domain/tournament.js';

const SCHEDULABLE = new Set(['pending', 'scheduled']);

async function requireStaff(deps: MatchesDeps, userId: string) {
  if (!(await deps.tournaments.isStaff(userId))) throw forbidden('staff_only');
}

async function loadMatch(deps: MatchesDeps, matchId: string) {
  const match = await deps.matches.find(matchId);
  if (!match) throw notFound('match_not_found');
  return match;
}

async function loadTournament(deps: MatchesDeps, tournamentId: string) {
  const tournament = await deps.tournaments.findById(tournamentId);
  if (!tournament) throw notFound('tournament_not_found');
  return tournament;
}

async function partyEntrant(deps: MatchesDeps, userId: string, match: MatchRecord) {
  const managed = await deps.entrants.managedBy(userId, match.tournamentId);
  const entrant = [match.entrantA, match.entrantB].find((e) => e !== null && managed.has(e));
  if (!entrant) throw forbidden('not_match_party');
  return entrant;
}

const windowsOf = (t: TournamentRecord) => t.config.schedule.windows;
const blackoutsOf = (t: TournamentRecord) => t.config.schedule.blackouts;

/** The time of a match and its check-in window; scheduled once both entrants are known. */
function scheduleSet(t: TournamentRecord, match: MatchRecord, at: string, keepOriginal: boolean) {
  const { opensAt, closesAt } = checkinWindow(
    at,
    t.config.schedule.checkinOpensMinutes,
    t.config.schedule.checkinClosesMinutes,
  );
  const known = match.entrantA !== null && match.entrantB !== null;
  const status =
    known && match.status === 'pending'
      ? matchLifecycle.transition(
          match.status,
          { type: 'schedule' },
          {
            entrantA: match.entrantA,
            entrantB: match.entrantB,
            checkedIn: [],
            result: null,
            disputeDeadline: null,
          },
        )
      : match.status;
  return {
    id: match.id,
    version: match.version,
    set: {
      status,
      scheduled_at: at,
      checkin_opens_at: opensAt,
      checkin_closes_at: closesAt,
      ...(keepOriginal && match.scheduledAt && !match.originalScheduledAt
        ? { original_scheduled_at: match.scheduledAt.toISOString() }
        : {}),
    },
  };
}

const matchEvent = (match: MatchRecord, type: string, payload: Record<string, unknown> = {}) => ({
  aggregate_type: 'match',
  aggregate_id: match.id,
  event_type: type,
  payload: { tournament_id: match.tournamentId, ...payload },
});

export class AutoScheduleUseCase {
  constructor(private readonly deps: MatchesDeps) {}

  /** Places every unscheduled match, phase after phase and round after round. */
  async execute(userId: string, tournamentId: string): Promise<{ scheduled: number }> {
    await requireStaff(this.deps, userId);
    const state = await loadState(this.deps, tournamentId);
    const t = state.tournament;
    const position = new Map(state.phases.map((p) => [p.id, p.position]));
    const pending = state.matches.filter(
      (m) => SCHEDULABLE.has(m.status) && m.scheduledAt === null,
    );
    if (pending.length === 0) return { scheduled: 0 };
    const now = this.deps.clock.now();
    const startsAt = t.config.schedule.startsAt ? new Date(t.config.schedule.startsAt) : now;
    const from = new Date(Math.max(now.getTime(), startsAt.getTime())).toISOString();
    // Rounds of later phases come after every round of earlier ones.
    const plan = autoSchedule(
      pending.map((m) => ({ id: m.id, round: (position.get(m.phaseId) ?? 0) * 1000 + m.round })),
      windowsOf(t),
      blackoutsOf(t),
      t.config.basics.timezone,
      from,
    );
    const change: CompetitionChange = {
      matches_update: pending.flatMap((m) => {
        const at = plan.get(m.id);
        return at ? [scheduleSet(t, m, at, false)] : [];
      }),
      events: [
        {
          aggregate_type: 'tournament',
          aggregate_id: tournamentId,
          event_type: 'tournament.scheduled',
          payload: { matches: plan.size },
        },
      ],
    };
    await this.deps.matches.commit(tournamentId, userId, compactUpdates(change));
    return { scheduled: plan.size };
  }
}

export class SetScheduleUseCase {
  constructor(private readonly deps: MatchesDeps) {}

  /** Staff sets the time; moving an already scheduled match needs a reason (audited). */
  async execute(userId: string, matchId: string, input: SetScheduleRequest): Promise<MatchDetail> {
    await requireStaff(this.deps, userId);
    const match = await loadMatch(this.deps, matchId);
    if (!SCHEDULABLE.has(match.status)) throw conflict('schedule_closed');
    const moving = match.scheduledAt !== null;
    if (moving && (input.reason ?? '').length < 10)
      throw new ApplicationError('invalid', 'reason_required');
    const t = await loadTournament(this.deps, match.tournamentId);
    await this.deps.matches.commit(match.tournamentId, userId, {
      matches_update: [scheduleSet(t, match, input.scheduledAt, true)],
      audits: moving
        ? [
            {
              action: 'match.rescheduled',
              entity_type: 'match',
              entity_id: match.id,
              before: { scheduled_at: match.scheduledAt.toISOString() },
              after: { scheduled_at: input.scheduledAt },
              reason: input.reason,
            },
          ]
        : [],
      events: [
        matchEvent(match, moving ? 'match.rescheduled' : 'match.scheduled', {
          at: input.scheduledAt,
        }),
      ],
    });
    return buildDetail(this.deps, await loadMatch(this.deps, matchId), userId);
  }
}

export class RequestRescheduleUseCase {
  constructor(private readonly deps: MatchesDeps) {}

  /** A captain proposes up to three times, inside the windows when the tournament says so. */
  async execute(userId: string, matchId: string, input: RescheduleRequest): Promise<MatchDetail> {
    const match = await loadMatch(this.deps, matchId);
    const entrant = await partyEntrant(this.deps, userId, match);
    if (!SCHEDULABLE.has(match.status)) throw conflict('schedule_closed');
    const t = await loadTournament(this.deps, match.tournamentId);
    const now = this.deps.clock.now();
    if (input.proposedAt.some((at) => Date.parse(at) <= now.getTime()))
      throw conflict('proposal_in_past');
    const windows = windowsOf(t);
    if (
      t.config.schedule.rescheduleWithinWindowsOnly &&
      windows.length > 0 &&
      !input.proposedAt.every((at) =>
        isWithinWindows(at, windows, blackoutsOf(t), t.config.basics.timezone),
      )
    )
      throw conflict('outside_schedule_windows');
    await this.deps.matches.commit(match.tournamentId, userId, {
      reschedules_insert: [
        {
          match_id: match.id,
          requested_by_entrant_id: entrant,
          requested_by_user_id: userId,
          proposed_at: input.proposedAt,
          reason: input.reason,
        },
      ],
      events: [matchEvent(match, 'reschedule.requested', { entrant_id: entrant })],
    });
    return buildDetail(this.deps, await loadMatch(this.deps, matchId), userId);
  }
}

async function loadRequest(deps: MatchesDeps, requestId: string) {
  const request = await deps.matches.findReschedule(requestId);
  if (!request) throw notFound('reschedule_not_found');
  return request;
}

export class RespondRescheduleUseCase {
  constructor(private readonly deps: MatchesDeps) {}

  /** The other captain accepts one of the proposals (then staff approves) or rejects them. */
  async execute(
    userId: string,
    requestId: string,
    input: RespondRescheduleRequest,
  ): Promise<MatchDetail> {
    const request = await loadRequest(this.deps, requestId);
    const match = await loadMatch(this.deps, request.matchId);
    const entrant = await partyEntrant(this.deps, userId, match);
    if (entrant === request.requestedByEntrantId) throw forbidden('not_the_opponent');
    if (request.status !== 'pending') throw conflict('reschedule_not_open');
    const chosen =
      input.decision === 'accept'
        ? request.proposedAt.find(
            (d) => input.chosenAt !== null && d.getTime() === Date.parse(input.chosenAt),
          )
        : null;
    if (input.decision === 'accept' && !chosen) throw conflict('invalid_choice');
    await this.deps.matches.commit(match.tournamentId, userId, {
      reschedules_update: [
        {
          id: request.id,
          set:
            input.decision === 'accept'
              ? { status: 'accepted', chosen_at: chosen?.toISOString(), responded_by: userId }
              : { status: 'rejected', responded_by: userId },
        },
      ],
      events: [
        matchEvent(
          match,
          input.decision === 'accept' ? 'reschedule.accepted' : 'reschedule.rejected',
        ),
      ],
    });
    return buildDetail(this.deps, await loadMatch(this.deps, match.id), userId);
  }
}

export class DecideRescheduleUseCase {
  constructor(private readonly deps: MatchesDeps) {}

  /** Staff approves the agreed time (the match moves, audited) or rejects the request. */
  async execute(
    userId: string,
    requestId: string,
    input: DecideRescheduleRequest,
  ): Promise<MatchDetail> {
    await requireStaff(this.deps, userId);
    const request = await loadRequest(this.deps, requestId);
    const match = await loadMatch(this.deps, request.matchId);
    const now = this.deps.clock.now().toISOString();
    if (input.decision === 'reject') {
      await this.deps.matches.commit(match.tournamentId, userId, {
        reschedules_update: [
          { id: request.id, set: { status: 'rejected', decided_by: userId, decided_at: now } },
        ],
        events: [matchEvent(match, 'reschedule.rejected')],
      });
      return buildDetail(this.deps, match, userId);
    }
    if (request.status !== 'accepted' || !request.chosenAt) throw conflict('reschedule_not_agreed');
    if (!SCHEDULABLE.has(match.status)) throw conflict('schedule_closed');
    const t = await loadTournament(this.deps, match.tournamentId);
    const at = request.chosenAt.toISOString();
    await this.deps.matches.commit(match.tournamentId, userId, {
      matches_update: [scheduleSet(t, match, at, true)],
      reschedules_update: [
        {
          id: request.id,
          set: { status: 'approved_by_admin', decided_by: userId, decided_at: now },
        },
      ],
      audits: [
        {
          action: 'match.rescheduled',
          entity_type: 'match',
          entity_id: match.id,
          before: { scheduled_at: match.scheduledAt?.toISOString() ?? null },
          after: { scheduled_at: at, request_id: request.id },
          reason: input.reason,
        },
      ],
      events: [matchEvent(match, 'match.rescheduled', { at })],
    });
    return buildDetail(this.deps, await loadMatch(this.deps, match.id), userId);
  }
}
