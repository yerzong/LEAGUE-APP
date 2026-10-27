// Orchestration of packages/core for a tournament: load the state, let the
// format strategy move the bracket, compute the phase progress, and turn the
// difference into the unit of work svc_commit_competition applies.
// No competition rule lives here: core decides, this file translates.

import type { MatchStatus, ReportedGameInput, ResultSource } from '@league/contracts';
import {
  matchLifecycle,
  pairNextSwissRound,
  phaseProgress,
  seedsFromAdvancement,
  tournamentLifecycle,
  type Entrant,
  type Match,
  type MatchContext,
  type MatchEvent,
  type PhaseFormatStrategy,
} from '@league/core';

import { notFound } from '../../../shared/application-error.js';
import { formatConfigOf, type TournamentRecord } from '../../tournaments/domain/tournament.js';
import {
  groupKey,
  mergeChanges,
  standingRows,
  toCoreMatches,
  toInserts,
  type CompetitionChange,
  type MatchRecord,
  type PhaseInfo,
} from '../domain/match.js';
import type { MatchesDeps } from './deps.js';

/** Hours to dispute a confirmed result (docs/13 §8). */
export const DISPUTE_WINDOW_HOURS = 24;

export interface CompetitionState {
  readonly tournament: TournamentRecord;
  readonly phases: readonly PhaseInfo[];
  readonly matches: readonly MatchRecord[];
  /** Tournament seed of every approved registration (Swiss pairings). */
  readonly seeds: ReadonlyMap<string, number>;
}

export async function loadState(
  deps: MatchesDeps,
  tournamentId: string,
): Promise<CompetitionState> {
  const tournament = await deps.tournaments.findById(tournamentId);
  if (!tournament) throw notFound('tournament_not_found');
  const [phaseRecords, matches, entrants] = await Promise.all([
    deps.tournaments.phases(tournamentId),
    deps.matches.matchesOf(tournamentId),
    deps.entrants.entrantsOf(tournamentId),
  ]);
  const phases = phaseRecords.flatMap((p) => {
    const config = tournament.config.format.phases[p.position - 1];
    return config
      ? [
          {
            id: p.id,
            name: p.name,
            position: p.position,
            status: p.status,
            config,
            groups: p.groups,
          },
        ]
      : [];
  });
  return {
    tournament,
    phases,
    matches,
    seeds: new Map(entrants.flatMap((e) => (e.seed === null ? [] : [[e.id, e.seed] as const]))),
  };
}

export function phaseOf(state: CompetitionState, phaseId: string): PhaseInfo {
  const phase = state.phases.find((p) => p.id === phaseId);
  if (!phase) throw notFound('phase_not_found');
  return phase;
}

export const strategyOf = (deps: MatchesDeps, phase: PhaseInfo): PhaseFormatStrategy =>
  deps.formats.get(phase.config.format);

export function matchContext(
  record: MatchRecord,
  checkedIn: readonly string[],
  winner: string | null = record.winnerId,
): MatchContext {
  return {
    entrantA: record.entrantA,
    entrantB: record.entrantB,
    checkedIn,
    result: winner === null ? null : { scoreA: record.scoreA, scoreB: record.scoreB, winner },
    disputeDeadline: record.disputeDeadline?.toISOString() ?? null,
  };
}

/** Applies several lifecycle events in order (each one validated by core). */
export function transitionAll(
  status: MatchStatus,
  events: readonly MatchEvent[],
  context: MatchContext,
): MatchStatus {
  return events.reduce(
    (current, event) => matchLifecycle.transition(current, event, context),
    status,
  );
}

/**
 * One update per match (later sets win, the first version is checked) and one
 * row per phase entrant (a known seed is kept): the SQL touches each row once.
 */
export function compactUpdates(change: CompetitionChange): CompetitionChange {
  const merged = new Map<string, NonNullable<CompetitionChange['matches_update']>[number]>();
  for (const update of change.matches_update ?? []) {
    const previous = merged.get(update.id);
    merged.set(
      update.id,
      previous ? { ...previous, set: { ...previous.set, ...update.set } } : update,
    );
  }
  const entrants = new Map<
    string,
    NonNullable<CompetitionChange['phase_entrants_upsert']>[number]
  >();
  for (const row of change.phase_entrants_upsert ?? []) {
    const key = `${row.phase_id}:${row.entrant_id}`;
    const previous = entrants.get(key);
    entrants.set(key, previous ? { ...row, seed: row.seed ?? previous.seed } : row);
  }
  return {
    ...change,
    ...(change.matches_update ? { matches_update: [...merged.values()] } : {}),
    ...(change.phase_entrants_upsert ? { phase_entrants_upsert: [...entrants.values()] } : {}),
  };
}

function diffUpdates(
  before: readonly Match[],
  after: readonly Match[],
  records: readonly MatchRecord[],
  phase: PhaseInfo,
): NonNullable<CompetitionChange['matches_update']> {
  const recordOf = new Map(
    records.filter((r) => r.phaseId === phase.id).map((r) => [r.bracketKey, r]),
  );
  return after.flatMap((m) => {
    const old = before.find((b) => b.id === m.id);
    const record = recordOf.get(m.id);
    if (!old || !record) return [];
    const set: Record<string, unknown> = {};
    if (m.status !== old.status) set.status = m.status;
    if (m.entrantA !== old.entrantA) set.entrant_a_id = m.entrantA;
    if (m.entrantB !== old.entrantB) set.entrant_b_id = m.entrantB;
    if (JSON.stringify(m.result) !== JSON.stringify(old.result)) {
      set.score_a = m.result?.scoreA ?? 0;
      set.score_b = m.result?.scoreB ?? 0;
      set.winner_entrant_id = m.result?.winner ?? null;
    }
    return Object.keys(set).length > 0 ? [{ id: record.id, version: record.version, set }] : [];
  });
}

const groupOfEntrant = (matches: readonly Match[], phase: PhaseInfo, entrantId: string) => {
  const key =
    matches.find((m) => m.entrantA === entrantId || m.entrantB === entrantId)?.groupId ?? null;
  return key === null ? null : (phase.groups.find((g) => groupKey(g.position) === key)?.id ?? null);
};

/** Fixtures of a phase for its entrants (packages/core generates them). */
export function generatePhase(
  deps: MatchesDeps,
  state: CompetitionState,
  phase: PhaseInfo,
  entrants: readonly Entrant[],
): CompetitionChange {
  const strategy = strategyOf(deps, phase);
  const matches = strategy.generateMatches(entrants, formatConfigOf(phase.config) as never);
  const now = deps.clock.now().toISOString();
  return compactUpdates(
    mergeChanges(
      {
        matches_insert: toInserts(matches, phase, deps.newId),
        phase_entrants_upsert: entrants.map((e) => ({
          phase_id: phase.id,
          group_id: groupOfEntrant(matches, phase, e.id),
          entrant_id: e.id,
          seed: e.seed,
          status: 'active',
        })),
        phases_update: [{ id: phase.id, status: 'in_progress', starts_at: now }],
        events: [
          {
            aggregate_type: 'tournament',
            aggregate_id: state.tournament.id,
            event_type: 'phase.started',
            payload: { phase_id: phase.id, matches: matches.length },
          },
        ],
      },
      standingsChange(deps, state, { ...phase, status: 'in_progress' }, matches, { next: false }),
    ),
  );
}

/**
 * Standings of the phase from core, and what follows when it is over: the
 * next phase with the qualified entrants, or the end of the tournament.
 */
function standingsChange(
  deps: MatchesDeps,
  state: CompetitionState,
  phase: PhaseInfo,
  matches: readonly Match[],
  { next }: { next: boolean },
): CompetitionChange {
  const strategy = strategyOf(deps, phase);
  const progress = phaseProgress(
    strategy,
    matches,
    formatConfigOf(phase.config),
    phase.config.points,
    phase.config.tiebreakers,
    phase.config.advance,
  );
  const tournamentId = state.tournament.id;
  const change: CompetitionChange = {
    standings_replace: [{ phase_id: phase.id, rows: standingRows(progress, phase) }],
    phase_entrants_upsert: Object.entries(progress.statuses).map(([entrantId, status]) => ({
      phase_id: phase.id,
      group_id: groupOfEntrant(matches, phase, entrantId),
      entrant_id: entrantId,
      seed: null,
      status,
    })),
    events: [
      {
        aggregate_type: 'tournament',
        aggregate_id: tournamentId,
        event_type: 'standings.updated',
        payload: { phase_id: phase.id },
      },
    ],
  };
  if (!next || !progress.complete || phase.status === 'completed') return change;

  const done: CompetitionChange = {
    phases_update: [{ id: phase.id, status: 'completed' }],
    events: [
      {
        aggregate_type: 'tournament',
        aggregate_id: tournamentId,
        event_type: 'phase.completed',
        payload: { phase_id: phase.id },
      },
    ],
  };
  const following = state.phases.find((p) => p.position === phase.position + 1);
  if (following) {
    if (progress.advancement?.status === 'resolved') {
      return mergeChanges(
        change,
        done,
        generatePhase(deps, state, following, seedsFromAdvancement(progress.advancement)),
      );
    }
    return mergeChanges(change, done, {
      events: [
        {
          aggregate_type: 'tournament',
          aggregate_id: tournamentId,
          event_type: 'phase.tiebreak_required',
          payload: {
            phase_id: phase.id,
            tied:
              progress.advancement?.status === 'requires_tiebreaker'
                ? progress.advancement.tiedAtCutoff
                : [],
          },
        },
      ],
    });
  }
  // The last phase ended: the tournament is complete (core lifecycle).
  const to = tournamentLifecycle.transition(
    state.tournament.status,
    { type: 'complete' },
    {
      phaseCount: state.phases.length,
      approvedEntrants: 0,
      minEntrants: 0,
      allPhasesCompleted: true,
    },
  );
  return mergeChanges(change, done, {
    tournament_transition: { from: state.tournament.status, to },
    events: [
      {
        aggregate_type: 'tournament',
        aggregate_id: tournamentId,
        event_type: 'tournament.completed',
        payload: { champion: progress.champion },
      },
    ],
  });
}

export interface Outcome {
  readonly winner: string;
  readonly scoreA: number;
  readonly scoreB: number;
  readonly forfeit?: boolean;
}

/**
 * A finished match: the strategy records it and moves its entrants on
 * (bracket links, grand final reset…), Swiss pairs the next round when the
 * current one ends, and the phase progress follows.
 */
export function completion(
  deps: MatchesDeps,
  state: CompetitionState,
  record: MatchRecord,
  outcome: Outcome,
  options: { source: ResultSource; games: readonly ReportedGameInput[] | null },
): CompetitionChange {
  const phase = phaseOf(state, record.phaseId);
  const strategy = strategyOf(deps, phase);
  const config = formatConfigOf(phase.config);
  const before = toCoreMatches(state.matches, phase);
  const current = before.find((m) => m.id === record.bracketKey);
  if (!current) throw notFound('match_not_found');

  let after = strategy.onMatchCompleted(before, {
    ...current,
    status: outcome.forfeit ? 'forfeit' : 'completed',
    result: {
      scoreA: outcome.scoreA,
      scoreB: outcome.scoreB,
      winner: outcome.winner,
      ...(outcome.forfeit ? { forfeit: true } : {}),
    },
  });

  if (phase.config.format === 'swiss' && !strategy.isComplete(after, config as never)) {
    const ids = [
      ...new Set(
        after.flatMap((m) => [m.entrantA, m.entrantB]).filter((x): x is string => x !== null),
      ),
    ];
    const entrants = ids
      .sort((a, b) => (state.seeds.get(a) ?? 999) - (state.seeds.get(b) ?? 999))
      .map((id, i) => ({ id, seed: i + 1 }));
    const round = Math.max(...after.map((m) => m.round));
    const terminal = new Set(['completed', 'forfeit', 'canceled']);
    if (after.filter((m) => m.round === round).every((m) => terminal.has(m.status)))
      after = pairNextSwissRound(entrants, after, config as never);
  }

  const now = deps.clock.now();
  const created = after.filter((m) => !before.some((b) => b.id === m.id));
  const change: CompetitionChange = {
    matches_insert: created.length > 0 ? toInserts(created, phase, deps.newId, state.matches) : [],
    matches_update: [
      ...diffUpdates(before, after, state.matches, phase),
      {
        id: record.id,
        version: record.version,
        set: {
          result_source: options.source,
          finalized_at: now.toISOString(),
          dispute_deadline: new Date(
            now.getTime() + DISPUTE_WINDOW_HOURS * 3_600_000,
          ).toISOString(),
        },
      },
    ],
    games_replace: options.games
      ? [
          {
            match_id: record.id,
            games: options.games.map((g) => ({
              game_number: g.number,
              status: 'completed',
              // Sides alternate; the real ones arrive with the Riot integration.
              blue_entrant_id: g.number % 2 === 1 ? record.entrantA : record.entrantB,
              red_entrant_id: g.number % 2 === 1 ? record.entrantB : record.entrantA,
              winner_entrant_id: g.winner === 'a' ? record.entrantA : record.entrantB,
              result_source: options.source,
              ended_at: now.toISOString(),
            })),
          },
        ]
      : [],
    events: [
      {
        aggregate_type: 'match',
        aggregate_id: record.id,
        event_type: outcome.forfeit ? 'match.forfeited' : 'match.completed',
        payload: {
          tournament_id: state.tournament.id,
          winner: outcome.winner,
          source: options.source,
        },
      },
    ],
  };
  return compactUpdates(
    mergeChanges(change, standingsChange(deps, state, phase, after, { next: true })),
  );
}

/** Whether a dependent match already started (an override would rewrite it). */
export const PLAYED = new Set<MatchStatus>([
  'checkin',
  'ready',
  'live',
  'awaiting_result',
  'disputed',
  'completed',
  'forfeit',
]);
