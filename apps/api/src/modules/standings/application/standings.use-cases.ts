// Boards: each phase with its matches (bracket or calendar) and its table as
// packages/core computed it, with the tiebreak detail that explains the order.

import type { PhaseBoard, StandingRow, TournamentBoard } from '@league/contracts';

import { forbidden, notFound } from '../../../shared/application-error.js';
import type { MatchesDeps } from '../../matches/application/deps.js';
import { loadState } from '../../matches/application/engine.js';
import type { StandingRecord } from '../../matches/application/ports.js';
import { toEntrant, toSummary } from '../../matches/application/views.js';
import type { EntrantView } from '../../registrations/application/registrations.use-cases.js';

const SIDE_ORDER = { upper: 0, lower: 1, final: 2 } as const;

function toRow(s: StandingRecord, entrants: ReadonlyMap<string, EntrantView>): StandingRow[] {
  const entrant = toEntrant(entrants.get(s.entrantId));
  if (!entrant) return [];
  return [
    {
      entrant,
      rank: s.rank,
      points: s.points,
      played: s.played,
      wins: s.wins,
      losses: s.losses,
      draws: s.draws,
      gameWins: s.gameWins,
      gameLosses: s.gameLosses,
      gameDiff: s.gameDiff,
      status: s.status,
      tiebreaks: (s.tiebreakDetails.steps ?? []).map((step) => ({
        criterion: step.criterion as StandingRow['tiebreaks'][number]['criterion'],
        value: step.value,
        among: [...step.among],
      })),
      tiedWith: [...(s.tiebreakDetails.tiedWith ?? [])],
    },
  ];
}

async function buildBoard(deps: MatchesDeps, tournamentId: string): Promise<TournamentBoard> {
  const state = await loadState(deps, tournamentId);
  const [standings, entrantList] = await Promise.all([
    deps.matches.standings(tournamentId),
    deps.entrants.entrantsOf(tournamentId),
  ]);
  const entrants = new Map(entrantList.map((e) => [e.id, e]));
  const phases: PhaseBoard[] = state.phases.map((phase) => {
    const rows = standings
      .filter((s) => s.phaseId === phase.id)
      .sort((a, b) => a.rank - b.rank)
      .map((s) => ({ s, row: toRow(s, entrants) }));
    const groups =
      phase.groups.length > 0
        ? phase.groups.map((g) => ({
            id: g.id,
            name: g.name,
            standings: rows.filter((r) => r.s.groupId === g.id).flatMap((r) => r.row),
          }))
        : [{ id: null, name: null, standings: rows.flatMap((r) => r.row) }];
    const following = state.phases.find((p) => p.position === phase.position + 1);
    return {
      id: phase.id,
      name: phase.name,
      position: phase.position,
      format: phase.config.format,
      seriesFormat: phase.config.seriesFormat,
      status: phase.status,
      groups,
      matches: state.matches
        .filter((m) => m.phaseId === phase.id)
        .sort(
          (a, b) =>
            (a.bracketSide ? SIDE_ORDER[a.bracketSide] : 0) -
              (b.bracketSide ? SIDE_ORDER[b.bracketSide] : 0) ||
            a.round - b.round ||
            a.position - b.position,
        )
        .map((m) => toSummary(m, phase, entrants, new Map())),
      tiebreakRequired: phase.status === 'completed' && following?.status === 'pending',
    };
  });
  const last = phases.at(-1);
  const championId =
    state.tournament.status === 'completed'
      ? (last?.groups[0]?.standings.find((r) => r.rank === 1)?.entrant.id ?? null)
      : null;
  return {
    tournamentId,
    status: state.tournament.status,
    timezone: state.tournament.config.basics.timezone,
    phases,
    champion: championId ? toEntrant(entrants.get(championId)) : null,
    canGenerateFixtures:
      state.tournament.status === 'registration_closed' && state.matches.length === 0,
  };
}

export class GetAdminBoardUseCase {
  constructor(private readonly deps: MatchesDeps) {}

  async execute(userId: string, tournamentId: string): Promise<TournamentBoard> {
    if (!(await this.deps.tournaments.isStaff(userId))) throw forbidden('staff_only');
    return buildBoard(this.deps, tournamentId);
  }
}

export class GetPublicBoardUseCase {
  constructor(private readonly deps: MatchesDeps) {}

  /** Same visibility as the public tournament page. */
  async execute(slug: string): Promise<TournamentBoard> {
    const tournament = await this.deps.tournaments.findBySlug(slug);
    if (
      !tournament ||
      tournament.status === 'draft' ||
      tournament.config.basics.visibility === 'private'
    )
      throw notFound('tournament_not_found');
    return buildBoard(this.deps, tournament.id);
  }
}
