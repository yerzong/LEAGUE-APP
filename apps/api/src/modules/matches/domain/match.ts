// Matches as stored, the unit of work applied by svc_commit_competition, and
// the mapping to the Match of packages/core (which decides everything).
import type {
  DisputeCategory,
  DisputeStatus,
  MatchStatus,
  PhaseConfig,
  ReportedGameInput,
  RescheduleStatus,
  ResultSource,
  SeriesFormat,
  StandingStatus,
} from '@league/contracts';
import type {
  BracketSide,
  Match,
  MatchSlot,
  PhaseEntrantStatus,
  PhaseProgress,
  SlotSource,
} from '@league/core';

export interface MatchRecord {
  readonly id: string;
  readonly tournamentId: string;
  readonly phaseId: string;
  readonly groupId: string | null;
  readonly bracketKey: string;
  readonly round: number;
  readonly position: number;
  readonly bracketSide: BracketSide | null;
  readonly entrantA: string | null;
  readonly entrantB: string | null;
  readonly sourceA: SlotSource | null;
  readonly sourceB: SlotSource | null;
  readonly nextWinnerId: string | null;
  readonly nextWinnerSlot: MatchSlot | null;
  readonly nextLoserId: string | null;
  readonly nextLoserSlot: MatchSlot | null;
  readonly seriesFormat: SeriesFormat;
  readonly draftMode: 'standard' | 'fearless';
  readonly isTiebreaker: boolean;
  readonly scheduledAt: Date | null;
  readonly originalScheduledAt: Date | null;
  readonly checkinOpensAt: Date | null;
  readonly checkinClosesAt: Date | null;
  readonly status: MatchStatus;
  readonly scoreA: number;
  readonly scoreB: number;
  readonly winnerId: string | null;
  readonly resultSource: ResultSource | null;
  readonly finalizedAt: Date | null;
  readonly disputeDeadline: Date | null;
  readonly version: number;
}

export interface GameRecord {
  readonly matchId: string;
  readonly number: number;
  readonly winnerId: string | null;
}

export interface ReportRecord {
  readonly matchId: string;
  readonly entrantId: string;
  readonly userId: string;
  readonly winnerId: string;
  readonly scoreA: number;
  readonly scoreB: number;
  readonly games: readonly ReportedGameInput[];
  readonly evidencePaths: readonly string[];
  readonly submittedAt: Date;
}

export interface DisputeRecord {
  readonly id: string;
  readonly matchId: string;
  readonly category: DisputeCategory;
  readonly description: string;
  readonly status: DisputeStatus;
  readonly openedByEntrantId: string | null;
  readonly resolution: string | null;
  readonly resolvedAt: Date | null;
  readonly createdAt: Date;
  readonly evidence: readonly {
    readonly id: string;
    readonly storagePath: string | null;
    readonly url: string | null;
    readonly note: string | null;
    readonly createdAt: Date;
  }[];
}

export interface RescheduleRecord {
  readonly id: string;
  readonly matchId: string;
  readonly requestedByEntrantId: string;
  readonly proposedAt: readonly Date[];
  readonly chosenAt: Date | null;
  readonly reason: string | null;
  readonly status: RescheduleStatus;
  readonly createdAt: Date;
}

/** A phase of the tournament with its configuration (from the wizard). */
export interface PhaseInfo {
  readonly id: string;
  readonly name: string;
  readonly position: number;
  readonly status: 'pending' | 'in_progress' | 'completed';
  readonly config: PhaseConfig;
  /** Groups by position (`g1` in packages/core is position 1). */
  readonly groups: readonly {
    readonly id: string;
    readonly name: string;
    readonly position: number;
  }[];
}

type MatchColumns = Partial<{
  status: MatchStatus;
  entrant_a_id: string | null;
  entrant_b_id: string | null;
  score_a: number;
  score_b: number;
  winner_entrant_id: string | null;
  result_source: ResultSource | null;
  finalized_at: string | null;
  dispute_deadline: string | null;
  scheduled_at: string | null;
  original_scheduled_at: string | null;
  checkin_opens_at: string | null;
  checkin_closes_at: string | null;
}>;

export interface StandingRowChange {
  readonly entrant_id: string;
  readonly group_id: string | null;
  readonly rank: number;
  readonly points: number;
  readonly played: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly game_wins: number;
  readonly game_losses: number;
  readonly game_diff: number;
  readonly tiebreak_details: unknown;
  readonly status: StandingStatus;
}

/** The payload of svc_commit_competition (snake case: it is written as is). */
export interface CompetitionChange {
  matches_insert?: Record<string, unknown>[];
  matches_update?: { id: string; version: number; set: MatchColumns }[];
  games_replace?: { match_id: string; games: Record<string, unknown>[] }[];
  phase_entrants_upsert?: {
    phase_id: string;
    group_id: string | null;
    entrant_id: string;
    seed: number | null;
    status: PhaseEntrantStatus;
  }[];
  phases_update?: { id: string; status?: string; starts_at?: string }[];
  standings_replace?: { phase_id: string; rows: StandingRowChange[] }[];
  checkins_insert?: Record<string, unknown>[];
  reports_insert?: Record<string, unknown>[];
  disputes_insert?: Record<string, unknown>[];
  disputes_update?: { id: string; set: Record<string, unknown> }[];
  evidence_insert?: Record<string, unknown>[];
  reschedules_insert?: Record<string, unknown>[];
  reschedules_update?: { id: string; set: Record<string, unknown> }[];
  tournament_transition?: { from: string; to: string };
  audits?: {
    action: string;
    entity_type: string;
    entity_id: string;
    before?: unknown;
    after?: unknown;
    reason?: string | null;
  }[];
  events?: {
    aggregate_type: string;
    aggregate_id: string;
    event_type: string;
    payload?: unknown;
  }[];
}

/** Merges unit-of-work fragments (lists are concatenated). */
export function mergeChanges(...changes: CompetitionChange[]): CompetitionChange {
  const merged: Record<string, unknown> = {};
  for (const change of changes) {
    for (const [key, value] of Object.entries(change)) {
      if (Array.isArray(value))
        merged[key] = [...((merged[key] as unknown[] | undefined) ?? []), ...(value as unknown[])];
      else if (value !== undefined) merged[key] = value;
    }
  }
  return merged;
}

const FINISHED = new Set<MatchStatus>(['completed', 'forfeit']);
export const groupKey = (position: number) => `g${String(position)}`;

/** The matches of a phase as packages/core sees them. */
export function toCoreMatches(records: readonly MatchRecord[], phase: PhaseInfo): Match[] {
  const keyOf = new Map(records.map((r) => [r.id, r.bracketKey]));
  const groupOf = new Map(phase.groups.map((g) => [g.id, groupKey(g.position)]));
  return records
    .filter((r) => r.phaseId === phase.id)
    .map((r) => ({
      id: r.bracketKey,
      round: r.round,
      position: r.position,
      groupId: r.groupId ? (groupOf.get(r.groupId) ?? null) : null,
      bracketSide: r.bracketSide,
      entrantA: r.entrantA,
      entrantB: r.entrantB,
      sourceA: r.sourceA,
      sourceB: r.sourceB,
      nextWinner:
        r.nextWinnerId && r.nextWinnerSlot
          ? { matchId: keyOf.get(r.nextWinnerId) ?? '', slot: r.nextWinnerSlot }
          : null,
      nextLoser:
        r.nextLoserId && r.nextLoserSlot
          ? { matchId: keyOf.get(r.nextLoserId) ?? '', slot: r.nextLoserSlot }
          : null,
      seriesFormat: r.seriesFormat,
      status: r.status,
      result:
        FINISHED.has(r.status) || r.winnerId !== null
          ? {
              scoreA: r.scoreA,
              scoreB: r.scoreB,
              winner: r.winnerId,
              ...(r.resultSource === 'checkin_forfeit' || r.status === 'forfeit'
                ? { forfeit: true }
                : {}),
              ...(r.resultSource === 'bye' ? { bye: true } : {}),
            }
          : null,
      ...(r.isTiebreaker ? { isTiebreaker: true } : {}),
    }));
}

/** New core matches → rows to insert (ids from `newId`, links resolved by bracket key). */
export function toInserts(
  matches: readonly Match[],
  phase: PhaseInfo,
  newId: () => string,
  existing: readonly MatchRecord[] = [],
): Record<string, unknown>[] {
  const ids = new Map(
    existing.filter((r) => r.phaseId === phase.id).map((r) => [r.bracketKey, r.id]),
  );
  for (const m of matches) if (!ids.has(m.id)) ids.set(m.id, newId());
  const groupId = (key: string | null) =>
    key === null ? null : (phase.groups.find((g) => groupKey(g.position) === key)?.id ?? null);
  const source = (s: SlotSource | null) => s;
  return matches.map((m) => ({
    id: ids.get(m.id),
    phase_id: phase.id,
    group_id: groupId(m.groupId),
    bracket_key: m.id,
    round: m.round,
    position: m.position,
    bracket_side: m.bracketSide,
    entrant_a_id: m.entrantA,
    entrant_b_id: m.entrantB,
    source_a: source(m.sourceA),
    source_b: source(m.sourceB),
    next_match_winner_id: m.nextWinner ? (ids.get(m.nextWinner.matchId) ?? null) : null,
    next_match_winner_slot: m.nextWinner?.slot ?? null,
    next_match_loser_id: m.nextLoser ? (ids.get(m.nextLoser.matchId) ?? null) : null,
    next_match_loser_slot: m.nextLoser?.slot ?? null,
    series_format: m.seriesFormat,
    draft_mode: phase.config.draftMode,
    is_tiebreaker: m.isTiebreaker === true,
    status: m.status,
    score_a: m.result?.scoreA ?? 0,
    score_b: m.result?.scoreB ?? 0,
    winner_entrant_id: m.result?.winner ?? null,
    result_source: m.result?.bye ? 'bye' : null,
    finalized_at: m.result ? new Date().toISOString() : null,
  }));
}

/** Rows of the standings table from the phase progress of packages/core. */
export function standingRows(progress: PhaseProgress, phase: PhaseInfo): StandingRowChange[] {
  const groupId = (key: string | null) =>
    key === null ? null : (phase.groups.find((g) => groupKey(g.position) === key)?.id ?? null);
  return progress.standings.map((s) => {
    const status = progress.statuses[s.entrantId] ?? 'active';
    return {
      entrant_id: s.entrantId,
      group_id: groupId(s.groupId),
      rank: s.rank,
      points: s.points,
      played: s.played,
      wins: s.wins,
      losses: s.losses,
      draws: s.draws,
      game_wins: s.gameWins,
      game_losses: s.gameLosses,
      game_diff: s.gameDiff,
      tiebreak_details: { steps: s.tiebreaks, tiedWith: s.tiedWith },
      status:
        status === 'advanced'
          ? 'qualified'
          : status === 'eliminated'
            ? 'eliminated'
            : 'in_contention',
    };
  });
}
