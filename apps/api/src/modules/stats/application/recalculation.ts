// Recalculation of one closed match (docs/specs/m09 §2–3): derive the lines
// of its games (packages/core), then everything they feed — aggregates by
// scope for the players and teams involved, the tournament's champion meta,
// the MVPs of game, match, week and tournament, and the achievements. The
// result is written in one transaction; running it twice writes the same.

import {
  aggregatePlayer,
  aggregateTeam,
  championMeta,
  championStats,
  deriveGameStats,
  evaluateAchievements,
  pickMvp,
  type MvpScope,
} from '@league/core';

import type { StatsDeps } from './deps.js';
import { readMatchData, sideEntrants, toGameInput } from './match-data.js';
import type {
  MatchStatsWrite,
  StatsMatch,
  StatsScope,
  StatsTournament,
  StoredMvp,
  StoredPlayerLine,
  StoredTeamLine,
} from './ports.js';

const CLOSED = new Set(['completed', 'forfeit', 'canceled']);

interface Scope {
  readonly scopeType: StatsScope;
  readonly scopeId: string | null;
}

/** The scopes a match of `t` feeds: the tournament, its season and circuit, all-time. */
function scopesOf(t: StatsTournament): Scope[] {
  return [
    { scopeType: 'tournament', scopeId: t.id },
    ...(t.seasonId ? [{ scopeType: 'season' as const, scopeId: t.seasonId }] : []),
    ...(t.circuitId ? [{ scopeType: 'circuit' as const, scopeId: t.circuitId }] : []),
    { scopeType: 'all_time', scopeId: null },
  ];
}

function inScope(
  scope: Scope,
  tournamentId: string,
  tournaments: ReadonlyMap<string, StatsTournament>,
): boolean {
  if (scope.scopeType === 'all_time') return true;
  if (scope.scopeType === 'tournament') return tournamentId === scope.scopeId;
  const t = tournaments.get(tournamentId);
  return scope.scopeType === 'season'
    ? t?.seasonId === scope.scopeId
    : t?.circuitId === scope.scopeId;
}

export const weekKey = (phaseId: string, round: number) => `${phaseId}:${String(round)}`;

/** The lines of the match's games that have readable match data. */
async function deriveMatch(deps: StatsDeps, match: StatsMatch) {
  const games = (await deps.stats.games([match.id])).filter((g) => g.status === 'completed');
  const parsed = games.flatMap((game) => {
    const data = readMatchData(game.payload);
    return data ? [{ game, data }] : [];
  });
  const entrantIds = [match.entrantA, match.entrantB].filter((id): id is string => id !== null);
  const [entrants, accounts] = await Promise.all([
    deps.stats.entrants(entrantIds),
    deps.stats.accountsByPuuid(parsed.flatMap(({ data }) => data.participants.map((p) => p.puuid))),
  ]);
  const playedAt = (endedAt: Date | null) =>
    (endedAt ?? match.finalizedAt ?? deps.clock.now()).toISOString();

  return {
    games,
    derived: parsed.map(({ game, data }) => {
      const sides = sideEntrants(data, game, entrants, accounts);
      const stats = deriveGameStats(toGameInput(data, sides, accounts));
      const at = playedAt(data.endedAt ?? game.endedAt);
      const players: StoredPlayerLine[] = stats.players.map((l) => ({
        ...l,
        gameId: game.id,
        matchId: match.id,
        tournamentId: match.tournamentId,
        playedAt: at,
      }));
      const teams: StoredTeamLine[] = stats.teams.map((t) => ({
        ...t,
        gameId: game.id,
        matchId: match.id,
        tournamentId: match.tournamentId,
        teamId: entrants.get(t.entrantId)?.teamId ?? null,
        playedAt: at,
      }));
      return { gameId: game.id, players, teams, events: stats.events };
    }),
  };
}

export async function recalculateMatch(
  deps: StatsDeps,
  matchId: string,
  requestedAt: string,
): Promise<{ awarded: number } | null> {
  const match = await deps.stats.match(matchId);
  if (!match) return null;
  const tournament = await deps.stats.tournament(match.tournamentId);
  if (!tournament) return null;

  const { games, derived } = await deriveMatch(deps, match);
  const newPlayers = derived.flatMap((g) => g.players);
  const newTeams = derived.flatMap((g) => g.teams);

  // Who this match touches now or touched before (an overridden result removes lines).
  const [oldPlayers, oldTeams] = await Promise.all([
    deps.stats.playerLines({ matchIds: [matchId] }),
    deps.stats.teamLines({ matchIds: [matchId] }),
  ]);
  const userIds = [
    ...new Set([...oldPlayers, ...newPlayers].flatMap((l) => (l.userId ? [l.userId] : []))),
  ];
  const teamIds = [
    ...new Set([...oldTeams, ...newTeams].flatMap((l) => (l.teamId ? [l.teamId] : []))),
  ];

  const [userHistory, teamHistory, tournamentPlayers, tournamentTeams, matches] = await Promise.all(
    [
      deps.stats.playerLines({ userIds, excludeMatchId: matchId }),
      deps.stats.teamLines({ teamIds, excludeMatchId: matchId }),
      deps.stats.playerLines({ tournamentId: match.tournamentId, excludeMatchId: matchId }),
      deps.stats.teamLines({ tournamentId: match.tournamentId, excludeMatchId: matchId }),
      deps.stats.matchesOf(match.tournamentId),
    ],
  );
  const players = [...userHistory, ...newPlayers.filter((l) => l.userId !== null)];
  const teamLines = [...teamHistory, ...newTeams.filter((l) => l.teamId !== null)];
  const allTournamentPlayers = [...tournamentPlayers, ...newPlayers];
  const tournaments = await deps.stats.tournaments([
    ...new Set([...players.map((l) => l.tournamentId), ...teamLines.map((l) => l.tournamentId)]),
  ]);
  tournaments.set(tournament.id, tournament);
  const scopes = scopesOf(tournament);

  // Players: aggregates and champions per scope ----------------------------------
  const playerAggregates: MatchStatsWrite['playerAggregates'][number][] = [];
  const playerAggregatesClear: MatchStatsWrite['playerAggregatesClear'][number][] = [];
  const championScopes: MatchStatsWrite['playerChampions']['scopes'][number][] = [];
  const championRows: MatchStatsWrite['playerChampions']['rows'][number][] = [];
  for (const userId of userIds) {
    const mine = players.filter((l) => l.userId === userId);
    for (const scope of scopes) {
      const lines = mine.filter((l) => inScope(scope, l.tournamentId, tournaments));
      const stats = aggregatePlayer(lines);
      if (stats) playerAggregates.push({ userId, ...scope, stats });
      else playerAggregatesClear.push({ userId, ...scope });
      championScopes.push({ userId, ...scope });
      for (const c of championStats(lines)) championRows.push({ userId, ...scope, ...c });
    }
  }

  // Teams -----------------------------------------------------------------------
  const teamAggregates = teamIds.flatMap((teamId) =>
    scopes.flatMap((scope) => {
      const stats = aggregateTeam(
        teamLines.filter((l) => l.teamId === teamId && inScope(scope, l.tournamentId, tournaments)),
      );
      return stats ? [{ teamId, ...scope, stats }] : [];
    }),
  );

  // Champion meta of the tournament ---------------------------------------------------
  const meta = championMeta({
    picks: allTournamentPlayers.map((l) => ({ championId: l.championId, win: l.win })),
    bans: [...tournamentTeams, ...newTeams].flatMap((t) => t.bans),
  });

  // MVPs ----------------------------------------------------------------------------
  const mvpScopes: { scopeType: MvpScope; scopeId: string }[] = [];
  const mvpAwards: MatchStatsWrite['mvpAwards'][number][] = [];
  const award = (
    scopeType: MvpScope,
    scopeId: string,
    lines: readonly StoredPlayerLine[],
    minGames = 1,
  ) => {
    mvpScopes.push({ scopeType, scopeId });
    const pick = pickMvp(lines, { minGames });
    if (!pick) return;
    const entrantId = lines.find((l) => l.userId === pick.userId)?.entrantId ?? null;
    mvpAwards.push({ scopeType, scopeId, entrantId, ...pick });
  };
  for (const game of games) {
    const lines = newPlayers.filter((l) => l.gameId === game.id && l.isMvp);
    award('game', game.id, lines);
  }
  award(
    'match',
    match.id,
    newPlayers.filter((l) => l.entrantId === match.winnerId),
  );
  const roundMatches = new Set(
    matches.filter((m) => m.phaseId === match.phaseId && m.round === match.round).map((m) => m.id),
  );
  award(
    'week',
    weekKey(match.phaseId, match.round),
    allTournamentPlayers.filter((l) => roundMatches.has(l.matchId)),
  );
  if (matches.every((m) => m.id === match.id || CLOSED.has(m.status))) {
    // Regulars only: at least half the games of the busiest player.
    const counts = new Map<string, number>();
    for (const l of allTournamentPlayers)
      if (l.userId) counts.set(l.userId, (counts.get(l.userId) ?? 0) + 1);
    const most = Math.max(0, ...counts.values());
    award('tournament', tournament.id, allTournamentPlayers, Math.max(1, Math.ceil(most / 2)));
  } else {
    mvpScopes.push({ scopeType: 'tournament', scopeId: tournament.id });
  }

  // Achievements -------------------------------------------------------------------
  const replaced = new Set(mvpScopes.map((s) => `${s.scopeType}:${s.scopeId}`));
  const [defs, storedMvps, awarded] = await Promise.all([
    deps.stats.achievements(tournament.organizationId),
    deps.stats.mvpAwards({ userIds }),
    deps.stats.awardedKeys(userIds),
  ]);
  const mvpsOf = (userId: string) => [
    ...storedMvps.filter(
      (m: StoredMvp) => m.userId === userId && !replaced.has(`${m.scopeType}:${m.scopeId}`),
    ),
    ...mvpAwards.filter((m) => m.userId === userId),
  ];
  const byKey = new Map(defs.filter((d) => d.active).map((d) => [d.key, d]));
  const achievements = userIds.flatMap((userId) =>
    evaluateAchievements(
      [...byKey.values()].map((d) => ({ id: d.key, criteria: d.criteria })),
      {
        lines: players.filter((l) => l.userId === userId),
        mvps: mvpsOf(userId).map((m) => ({ scope: m.scopeType })),
      },
      awarded.get(userId) ?? new Set(),
    ).map((e) => ({
      userId,
      achievementId: byKey.get(e.achievementId)?.id ?? '',
      context: e.context,
    })),
  );

  const awardedCount = await deps.stats.saveMatchStats(matchId, requestedAt, {
    games: derived.map(({ gameId, players: p, teams: t, events }) => ({
      gameId,
      players: p,
      teams: t,
      events,
    })),
    playerAggregates,
    playerAggregatesClear,
    playerChampions: { scopes: championScopes, rows: championRows },
    teamAggregates,
    championMeta: meta,
    mvpScopes,
    mvpAwards,
    achievements,
  });
  return { awarded: awardedCount };
}
