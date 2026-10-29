// Stats use cases (docs/specs/m09): the recalculation queue, match data
// uploaded by staff, the public stats of players, teams, tournaments and
// matches, follows and the achievement rules.

import {
  LEADER_STATS,
  type AdminAchievementList,
  type AttachMatchDataRequest,
  type Champion,
  type FollowItem,
  type FollowList,
  type FollowRequest,
  type FollowState,
  type HeadToHead,
  type LeaderStat,
  type MatchStats,
  type PlayerMatch,
  type PlayerRef,
  type PlayerStats,
  type RecalculateStatsResponse,
  type SaveAchievementRequest,
  type TeamStats,
  type TournamentStats,
} from '@league/contracts';
import {
  headToHead,
  nextAttemptAt,
  recentForm,
  weeklyEvolution,
  type PlayerAggregate,
} from '@league/core';
import { format, DEFAULT_LOCALE, getMessages } from '@league/i18n';

import { conflict, forbidden, notFound } from '../../../shared/application-error.js';
import { canSee } from '../../identity/domain/profile.js';
import type { StatsDeps } from './deps.js';
import { payloadWinner, readMatchData, sideEntrants } from './match-data.js';
import type { FollowTarget, StatsMatch, StatsTournament } from './ports.js';
import { recalculateMatch } from './recalculation.js';

const server = getMessages(DEFAULT_LOCALE).stats.server;
const CLOSED = new Set(['completed', 'forfeit']);
const LEASE_SECONDS = 120;

const errorText = (error: unknown) =>
  (error instanceof Error ? `${error.name}: ${error.message}` : 'unknown error').slice(0, 500);

async function requireStaff(deps: StatsDeps, userId: string) {
  if (!(await deps.profiles.isStaff(userId))) throw forbidden('staff_only');
}

async function championsOf(deps: StatsDeps) {
  const map = await deps.champions.champions();
  return (id: number): Champion => {
    const found = map.get(id);
    return {
      id,
      name: found?.name ?? format(server.unknownChampion, { id: String(id) }),
      iconUrl: found?.iconUrl ?? null,
    };
  };
}

/** Public references of users with a username (others are left out). */
async function refsOf(deps: StatsDeps, userIds: readonly string[]) {
  const summaries = await deps.profiles.summaries([...new Set(userIds)]);
  const refs = new Map<string, PlayerRef>();
  for (const [id, s] of summaries)
    if (s.username)
      refs.set(id, { username: s.username, displayName: s.displayName, avatarUrl: s.avatarUrl });
  return refs;
}

async function followState(
  deps: StatsDeps,
  viewerId: string | null,
  target: FollowTarget,
): Promise<FollowState> {
  const [followers, following] = await Promise.all([
    deps.follows.followerCount(target),
    viewerId ? deps.follows.isFollowing(viewerId, target) : Promise.resolve(false),
  ]);
  return { followers, following };
}

/** Series record of some registrations (closed matches, byes excluded). */
function recordOf(matches: readonly StatsMatch[], entrantIds: ReadonlySet<string>) {
  const played = matches.filter((m) => m.entrantA !== null && m.entrantB !== null);
  const results = played.map((m) => ({
    win: m.winnerId !== null && entrantIds.has(m.winnerId),
    playedAt: (m.finalizedAt ?? new Date(0)).toISOString(),
  }));
  const wins = results.filter((r) => r.win).length;
  return {
    record: { matches: results.length, wins, losses: results.length - wins },
    form: recentForm(results, 5),
  };
}

// ---------------------------------------------------------------------------
// Queue and recalculation
// ---------------------------------------------------------------------------

export class ProcessStatsJobsUseCase {
  constructor(private readonly deps: StatsDeps) {}

  async execute(): Promise<{ processed: number; failed: number }> {
    const jobs = await this.deps.stats.claimJobs(this.deps.settings.batchSize, LEASE_SECONDS);
    let processed = 0;
    let failed = 0;
    // One at a time: jobs of the same tournament share its meta and MVPs.
    for (const job of jobs) {
      try {
        await recalculateMatch(this.deps, job.matchId, job.requestedAt);
        processed += 1;
      } catch (error) {
        failed += 1;
        const next = nextAttemptAt(job.attempts + 1, this.deps.clock.now());
        await this.deps.stats.failJob(job.matchId, errorText(error), next, next === null);
      }
    }
    return { processed, failed };
  }
}

export class RecalculateTournamentStatsUseCase {
  constructor(private readonly deps: StatsDeps) {}

  async execute(actorId: string, tournamentId: string): Promise<RecalculateStatsResponse> {
    await requireStaff(this.deps, actorId);
    if (!(await this.deps.stats.tournament(tournamentId))) throw notFound('tournament_not_found');
    return { matches: await this.deps.stats.requestTournament(tournamentId, actorId) };
  }
}

/** Staff uploads the Match-V5 data of a completed game (the manual path until m08). */
export class AttachGameDataUseCase {
  constructor(private readonly deps: StatsDeps) {}

  async execute(actorId: string, gameId: string, input: AttachMatchDataRequest): Promise<void> {
    await requireStaff(this.deps, actorId);
    const game = await this.deps.stats.game(gameId);
    if (!game) throw notFound('game_not_found');
    if (game.status !== 'completed') throw conflict('game_not_completed');
    const data = readMatchData(input.data);
    if (!data) throw conflict('match_data_invalid');

    const puuids = data.participants.map((p) => p.puuid);
    const [entrants, accounts] = await Promise.all([
      this.deps.stats.entrants([game.blueEntrantId, game.redEntrantId]),
      this.deps.stats.accountsByPuuid(puuids),
    ]);
    if (new Set(puuids).size !== puuids.length) throw conflict('match_data_invalid');
    const sides = sideEntrants(data, game, entrants, accounts);
    if (payloadWinner(data, sides) !== game.winnerEntrantId)
      throw conflict('match_data_winner_mismatch');

    const bans = data.teams
      .flatMap((t) => t.bans.map((b) => ({ ...b, side: t.side })))
      .sort((a, b) => a.turn - b.turn || a.side.localeCompare(b.side));
    await this.deps.stats.attachGameData(gameId, actorId, {
      payload: input.data,
      durationSeconds: data.durationSeconds,
      patch: data.patch,
      riotMatchId: data.matchId,
      blueEntrantId: sides.blue,
      redEntrantId: sides.red,
      participants: data.participants.map((p) => {
        const account = accounts.get(p.puuid);
        const entrantId = sides[p.side];
        return {
          entrantId,
          userId: account?.userId ?? null,
          riotAccountId: account?.riotAccountId ?? null,
          puuid: p.puuid,
          side: p.side,
          role: p.role,
          championId: p.championId,
          isExpected:
            account !== undefined &&
            (entrants.get(entrantId)?.userIds.includes(account.userId) ?? false),
        };
      }),
      draft: [
        ...bans.map((b, i) => ({
          entrantId: sides[b.side],
          action: 'ban' as const,
          championId: b.championId,
          sequence: i + 1,
          side: b.side,
        })),
        ...data.participants.map((p, i) => ({
          entrantId: sides[p.side],
          action: 'pick' as const,
          championId: p.championId,
          sequence: bans.length + i + 1,
          side: p.side,
        })),
      ],
    });
  }
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export class GetPlayerStatsUseCase {
  constructor(private readonly deps: StatsDeps) {}

  async execute(username: string, viewerId: string | null): Promise<PlayerStats> {
    const profile = await this.deps.profiles.findByUsername(username);
    if (!profile?.username) throw notFound('player_not_found');
    const userId = profile.id;
    const entrantIds = await this.deps.stats.entrantsOfUser(userId);
    const [aggregates, lines, matches, privacy, achievements, mvps, champion, refs, follow] =
      await Promise.all([
        this.deps.stats.playerAggregates(userId),
        this.deps.stats.playerLines({ userIds: [userId] }),
        this.deps.stats.closedMatchesOfEntrants(entrantIds),
        this.deps.profiles.privacyOf([userId]),
        this.deps.stats.achievementsOf(userId),
        this.deps.stats.mvpAwards({ userIds: [userId] }),
        championsOf(this.deps),
        refsOf(this.deps, [userId]),
        followState(this.deps, viewerId, { type: 'user', id: userId }),
      ]);
    const champions = await this.deps.stats.playerChampions([userId], 'all_time', null);
    const mine = new Set(entrantIds);
    const opponents = matches.flatMap((m) => [m.entrantA, m.entrantB]).filter((e) => e !== null);
    const [entrants, tournaments] = await Promise.all([
      this.deps.stats.entrants(opponents),
      this.deps.stats.tournaments([
        ...new Set([
          ...matches.map((m) => m.tournamentId),
          ...aggregates.flatMap((a) =>
            a.scopeType === 'tournament' && a.scopeId ? [a.scopeId] : [],
          ),
          ...mvps.map((m) => m.tournamentId),
          ...achievements.flatMap((a) => (a.tournamentId ? [a.tournamentId] : [])),
        ]),
      ]),
    ]);
    const tournamentRef = (id: string) => {
      const t = tournaments.get(id);
      return t ? { id: t.id, slug: t.slug, name: t.name } : null;
    };
    const showTeams = canSee(privacy.get(userId)?.teams ?? 'private', 'public');
    const { record, form } = recordOf(matches, mine);

    const history = [...matches]
      .sort((a, b) => (b.finalizedAt?.getTime() ?? 0) - (a.finalizedAt?.getTime() ?? 0))
      .slice(0, 10)
      .flatMap((m): PlayerMatch[] => {
        const tournament = tournamentRef(m.tournamentId);
        const own = m.entrantA && mine.has(m.entrantA) ? 'a' : 'b';
        const entrant = own === 'a' ? m.entrantA : m.entrantB;
        const opponent = own === 'a' ? m.entrantB : m.entrantA;
        if (!tournament || !entrant || !opponent) return [];
        return [
          {
            matchId: m.id,
            tournament,
            playedAt: (m.finalizedAt ?? new Date(0)).toISOString(),
            entrantName: showTeams ? (entrants.get(entrant)?.name ?? null) : null,
            opponentName: entrants.get(opponent)?.name ?? null,
            result: m.winnerId === entrant ? 'win' : 'loss',
            scoreFor: own === 'a' ? m.scoreA : m.scoreB,
            scoreAgainst: own === 'a' ? m.scoreB : m.scoreA,
            games: lines
              .filter((l) => l.matchId === m.id)
              .sort((x, y) => x.playedAt.localeCompare(y.playedAt))
              .map((l) => ({
                champion: champion(l.championId),
                role: l.role,
                kills: l.kills,
                deaths: l.deaths,
                assists: l.assists,
                csPerMin: l.csPerMin,
                isMvp: l.isMvp,
              })),
          },
        ];
      });

    const player = refs.get(userId) ?? {
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: null,
    };
    return {
      player,
      record,
      form,
      overall: aggregates.find((a) => a.scopeType === 'all_time')?.stats ?? null,
      tournaments: aggregates.flatMap((a) => {
        const tournament =
          a.scopeType === 'tournament' && a.scopeId ? tournamentRef(a.scopeId) : null;
        return tournament ? [{ tournament, stats: a.stats }] : [];
      }),
      champions: champions
        .sort((a, b) => b.games - a.games || b.wins - a.wins || a.championId - b.championId)
        .slice(0, 8)
        .map(({ championId, games, wins, kills, deaths, assists, kda }) => ({
          champion: champion(championId),
          games,
          wins,
          kills,
          deaths,
          assists,
          kda,
        })),
      evolution: weeklyEvolution(lines).slice(-12),
      achievements: achievements.map((a) => ({
        key: a.achievement.key,
        name: a.achievement.name,
        description: a.achievement.description,
        icon: a.achievement.icon,
        awardedAt: a.awardedAt.toISOString(),
        tournament: a.tournamentId ? tournamentRef(a.tournamentId) : null,
      })),
      mvps: mvps
        .filter((m) => m.scopeType !== 'game')
        .flatMap((m) => {
          const tournament = tournamentRef(m.tournamentId);
          if (!tournament) return [];
          const round = m.scopeType === 'week' ? Number(m.scopeId.split(':')[1]) : null;
          return [{ scope: m.scopeType, tournament, round, awardedAt: m.awardedAt.toISOString() }];
        }),
      history,
      follow,
    };
  }
}

export class GetHeadToHeadUseCase {
  constructor(private readonly deps: StatsDeps) {}

  async execute(usernameA: string, usernameB: string): Promise<HeadToHead> {
    const [a, b] = await Promise.all([
      this.deps.profiles.findByUsername(usernameA),
      this.deps.profiles.findByUsername(usernameB),
    ]);
    if (!a?.username || !b?.username) throw notFound('player_not_found');
    if (a.id === b.id) throw conflict('same_player');
    const [linesA, linesB, refs] = await Promise.all([
      this.deps.stats.playerLines({ userIds: [a.id] }),
      this.deps.stats.playerLines({ userIds: [b.id] }),
      refsOf(this.deps, [a.id, b.id]),
    ]);
    const h2h = headToHead(linesA, linesB);
    const ref = (p: typeof a) =>
      refs.get(p.id) ?? { username: p.username ?? '', displayName: p.displayName, avatarUrl: null };
    return {
      a: ref(a),
      b: ref(b),
      games: h2h.games,
      winsA: h2h.winsA,
      winsB: h2h.winsB,
      statsA: h2h.a,
      statsB: h2h.b,
    };
  }
}

// ---------------------------------------------------------------------------
// Teams and tournaments
// ---------------------------------------------------------------------------

export class GetTeamStatsUseCase {
  constructor(private readonly deps: StatsDeps) {}

  async execute(slug: string, viewerId: string | null): Promise<TeamStats> {
    const team = await this.deps.teams.findBySlug(slug);
    if (!team) throw notFound('team_not_found');
    const [entrantIds, members, overall, follow, champion] = await Promise.all([
      this.deps.stats.entrantsOfTeam(team.id),
      this.deps.teams.activeMembers(team.id),
      this.deps.stats.teamAggregate(team.id),
      followState(this.deps, viewerId, { type: 'team', id: team.id }),
      championsOf(this.deps),
    ]);
    const memberIds = members.map((m) => m.userId);
    const [matches, privacy, refs, aggregates, champions] = await Promise.all([
      this.deps.stats.closedMatchesOfEntrants(entrantIds),
      this.deps.profiles.privacyOf(memberIds),
      refsOf(this.deps, memberIds),
      Promise.all(memberIds.map((id) => this.deps.stats.playerAggregates(id))),
      this.deps.stats.playerChampions(memberIds, 'all_time', null),
    ]);
    const { record, form } = recordOf(matches, new Set(entrantIds));
    return {
      record,
      form,
      overall,
      roster: members.flatMap((member, i) => {
        const player = refs.get(member.userId);
        // A player who hides their teams does not appear on the team page.
        if (!player || !canSee(privacy.get(member.userId)?.teams ?? 'private', 'public')) return [];
        const top = champions
          .filter((c) => c.userId === member.userId)
          .sort((a, b) => b.games - a.games || b.wins - a.wins)[0];
        return [
          {
            player,
            teamRole: member.teamRole,
            stats: aggregates[i]?.find((a) => a.scopeType === 'all_time')?.stats ?? null,
            topChampion: top ? champion(top.championId) : null,
          },
        ];
      }),
      follow,
    };
  }
}

const LEADER_FIELD: Record<LeaderStat, keyof PlayerAggregate> = {
  kda: 'kda',
  damagePerMin: 'avgDamagePerMin',
  csPerMin: 'avgCsPerMin',
  visionPerMin: 'avgVisionPerMin',
  kills: 'kills',
};

async function publicTournament(deps: StatsDeps, slug: string): Promise<StatsTournament> {
  const tournament = await deps.stats.tournamentBySlug(slug);
  if (!tournament?.isPublic) throw notFound('tournament_not_found');
  return tournament;
}

export class GetTournamentStatsUseCase {
  constructor(private readonly deps: StatsDeps) {}

  async execute(slug: string, viewerId: string | null): Promise<TournamentStats> {
    const tournament = await publicTournament(this.deps, slug);
    const [rows, meta, teamLines, matches, mvps, phases, champion, follow] = await Promise.all([
      this.deps.stats.playerAggregatesOfScope('tournament', tournament.id),
      this.deps.stats.championMeta(tournament.id),
      this.deps.stats.teamLines({ tournamentId: tournament.id }),
      this.deps.stats.matchesOf(tournament.id),
      this.deps.stats.mvpAwards({ tournamentId: tournament.id }),
      this.deps.stats.phaseNames(tournament.id),
      championsOf(this.deps),
      followState(this.deps, viewerId, { type: 'tournament', id: tournament.id }),
    ]);
    const games = await this.deps.stats.games(
      matches.filter((m) => CLOSED.has(m.status)).map((m) => m.id),
    );
    const gamesWithData = new Set(teamLines.map((l) => l.gameId)).size;
    const refs = await refsOf(this.deps, [
      ...rows.map((r) => r.userId),
      ...mvps.map((m) => m.userId),
    ]);

    // Averages need a fair sample: a third of the games of the busiest player.
    const most = Math.max(0, ...rows.map((r) => r.stats.games));
    const minGames = Math.max(1, Math.ceil(most / 3));
    const leaders = LEADER_STATS.map((stat) => ({
      stat,
      entries: rows
        .filter((r) => r.stats.games >= minGames && refs.has(r.userId))
        .map((r) => ({
          player: refs.get(r.userId) as PlayerRef,
          value: r.stats[LEADER_FIELD[stat]] as number,
          games: r.stats.games,
        }))
        .sort((a, b) => b.value - a.value || b.games - a.games)
        .slice(0, 5),
    }));

    const tournamentMvp = mvps.find((m) => m.scopeType === 'tournament');
    return {
      gamesWithData,
      gamesPlayed: games.filter((g) => g.status === 'completed').length,
      leaders,
      champions: meta.slice(0, 15).map((m) => ({
        champion: champion(m.championId),
        picks: m.picks,
        bans: m.bans,
        wins: m.wins,
        presence: gamesWithData > 0 ? Math.min(1, (m.picks + m.bans) / gamesWithData) : 0,
      })),
      weeklyMvps: mvps
        .filter((m) => m.scopeType === 'week' && refs.has(m.userId))
        .map((m) => {
          const [phaseId = '', round = '1'] = m.scopeId.split(':');
          return {
            phaseName: phases.get(phaseId) ?? '',
            round: Number(round),
            player: refs.get(m.userId) as PlayerRef,
            score: m.score,
          };
        })
        .sort((a, b) => a.phaseName.localeCompare(b.phaseName) || a.round - b.round),
      mvp:
        tournamentMvp && refs.has(tournamentMvp.userId)
          ? {
              player: refs.get(tournamentMvp.userId) as PlayerRef,
              score: tournamentMvp.score,
              games: tournamentMvp.games,
            }
          : null,
      follow,
    };
  }
}

/** Box score of each game; games without match data only show the winner. */
export class GetMatchStatsUseCase {
  constructor(private readonly deps: StatsDeps) {}

  async execute(matchId: string): Promise<MatchStats> {
    const match = await this.deps.stats.match(matchId);
    const tournament = match ? await this.deps.stats.tournament(match.tournamentId) : null;
    if (!match || !tournament?.isPublic) throw notFound('match_not_found');
    const [games, lines, teams, champion] = await Promise.all([
      this.deps.stats.games([matchId]),
      this.deps.stats.playerLines({ matchIds: [matchId] }),
      this.deps.stats.teamLines({ matchIds: [matchId] }),
      championsOf(this.deps),
    ]);
    const refs = await refsOf(
      this.deps,
      lines.flatMap((l) => (l.userId ? [l.userId] : [])),
    );
    return {
      games: games
        .filter((g) => g.status === 'completed')
        .sort((a, b) => a.number - b.number)
        .map((game) => {
          const gameTeams = teams.filter((t) => t.gameId === game.id);
          const riotIds = new Map(
            (readMatchData(game.payload)?.participants ?? []).map((p) => [p.puuid, p.riotId]),
          );
          return {
            number: game.number,
            hasData: gameTeams.length > 0,
            durationSeconds: gameTeams.length > 0 ? game.durationSeconds : null,
            teams: gameTeams
              .sort((a, b) => a.side.localeCompare(b.side))
              .map((t) => ({
                entrantId: t.entrantId,
                side: t.side,
                win: t.win,
                kills: t.kills,
                towers: t.towers,
                dragons: t.dragons,
                barons: t.barons,
                bans: t.bans.map(champion),
                players: lines
                  .filter((l) => l.gameId === game.id && l.side === t.side)
                  .map((l) => {
                    const player = l.userId ? (refs.get(l.userId) ?? null) : null;
                    return {
                      player,
                      name: player?.displayName ?? player?.username ?? riotIds.get(l.puuid) ?? '—',
                      champion: champion(l.championId),
                      role: l.role,
                      kills: l.kills,
                      deaths: l.deaths,
                      assists: l.assists,
                      cs: l.cs,
                      gold: l.gold,
                      damage: l.damageToChampions,
                      visionScore: l.visionScore,
                      isMvp: l.isMvp,
                    };
                  }),
              })),
          };
        }),
    };
  }
}

// ---------------------------------------------------------------------------
// Follows (private to the follower; counts are public)
// ---------------------------------------------------------------------------

async function resolveTarget(deps: StatsDeps, request: FollowRequest): Promise<FollowTarget> {
  switch (request.type) {
    case 'team': {
      const team = await deps.teams.findBySlug(request.key);
      if (!team || team.status !== 'active') throw notFound('team_not_found');
      return { type: 'team', id: team.id };
    }
    case 'user': {
      const profile = await deps.profiles.findByUsername(request.key);
      if (!profile?.username) throw notFound('player_not_found');
      return { type: 'user', id: profile.id };
    }
    case 'tournament': {
      const tournament = await publicTournament(deps, request.key);
      return { type: 'tournament', id: tournament.id };
    }
  }
}

export class FollowUseCase {
  constructor(private readonly deps: StatsDeps) {}

  async execute(userId: string, request: FollowRequest): Promise<FollowState> {
    const target = await resolveTarget(this.deps, request);
    if (target.type === 'user' && target.id === userId) throw conflict('cannot_follow_self');
    await this.deps.follows.follow(userId, target);
    return followState(this.deps, userId, target);
  }
}

export class UnfollowUseCase {
  constructor(private readonly deps: StatsDeps) {}

  async execute(userId: string, request: FollowRequest): Promise<FollowState> {
    const target = await resolveTarget(this.deps, request);
    await this.deps.follows.unfollow(userId, target);
    return followState(this.deps, userId, target);
  }
}

export class ListMyFollowsUseCase {
  constructor(private readonly deps: StatsDeps) {}

  async execute(userId: string): Promise<FollowList> {
    const follows = await this.deps.follows.followsOf(userId);
    const ids = (type: FollowTarget['type']) =>
      follows.filter((f) => f.type === type).map((f) => f.id);
    const [teams, refs, tournaments] = await Promise.all([
      Promise.all(ids('team').map((id) => this.deps.teams.findById(id))),
      refsOf(this.deps, ids('user')),
      this.deps.stats.tournaments(ids('tournament')),
    ]);
    const teamById = new Map(teams.flatMap((t) => (t ? [[t.id, t] as const] : [])));
    return {
      items: follows.flatMap((f): FollowItem[] => {
        const followedAt = f.createdAt.toISOString();
        if (f.type === 'team') {
          const team = teamById.get(f.id);
          return team && team.status === 'active'
            ? [
                {
                  type: 'team' as const,
                  key: team.slug,
                  name: team.name,
                  imageUrl: this.deps.teams.logoUrl(team.logoPath),
                  href: `/equipos/${team.slug}`,
                  followedAt,
                },
              ]
            : [];
        }
        if (f.type === 'user') {
          const ref = refs.get(f.id);
          return ref
            ? [
                {
                  type: 'user' as const,
                  key: ref.username,
                  name: ref.displayName ?? ref.username,
                  imageUrl: ref.avatarUrl,
                  href: `/jugadores/${ref.username}`,
                  followedAt,
                },
              ]
            : [];
        }
        const t = tournaments.get(f.id);
        return t?.isPublic
          ? [
              {
                type: 'tournament' as const,
                key: t.slug,
                name: t.name,
                imageUrl: null,
                href: `/torneos/${t.slug}`,
                followedAt,
              },
            ]
          : [];
      }),
    };
  }
}

// ---------------------------------------------------------------------------
// Achievement rules (staff)
// ---------------------------------------------------------------------------

export class ListAchievementsUseCase {
  constructor(private readonly deps: StatsDeps) {}

  async execute(actorId: string): Promise<AdminAchievementList> {
    await requireStaff(this.deps, actorId);
    const defs = await this.deps.stats.achievements(await this.deps.organization.id());
    const counts = await this.deps.stats.achievementCounts(defs.map((d) => d.id));
    return {
      items: defs.map((d) => ({
        key: d.key,
        name: d.name,
        description: d.description,
        icon: d.icon,
        criteria: d.criteria,
        active: d.active,
        scope: d.organizationId === null ? ('platform' as const) : ('organization' as const),
        awarded: counts.get(d.id) ?? 0,
      })),
    };
  }
}

/** Saves the organization's version of a rule (a platform rule is overridden, not edited). */
export class SaveAchievementUseCase {
  constructor(private readonly deps: StatsDeps) {}

  async execute(actorId: string, key: string, input: SaveAchievementRequest): Promise<void> {
    await requireStaff(this.deps, actorId);
    await this.deps.stats.saveAchievement(await this.deps.organization.id(), actorId, {
      key,
      ...input,
    });
  }
}
