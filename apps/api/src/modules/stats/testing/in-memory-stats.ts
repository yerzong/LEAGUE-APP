// StatsRepository and FollowRepository over plain arrays, with the replace
// and upsert semantics of svc_save_match_stats.
import type { TeamAggregate } from '@league/core';

import type {
  AchievementRecord,
  AttachGameWrite,
  FollowRepository,
  FollowTarget,
  MatchStatsWrite,
  StatsEntrant,
  StatsGame,
  StatsMatch,
  StatsRepository,
  StatsScope,
  StatsTournament,
  StoredMvp,
  StoredPlayerLine,
  StoredTeamLine,
} from '../application/ports.js';

type AggregateRow = MatchStatsWrite['playerAggregates'][number];
type ChampionRow = MatchStatsWrite['playerChampions']['rows'][number];

const sameScope = (
  a: { userId: string; scopeType: StatsScope; scopeId: string | null },
  b: { userId: string; scopeType: StatsScope; scopeId: string | null },
) => a.userId === b.userId && a.scopeType === b.scopeType && a.scopeId === b.scopeId;

export class InMemoryStatsRepository implements StatsRepository {
  matches: StatsMatch[] = [];
  gamesList: StatsGame[] = [];
  readonly tournamentList = new Map<string, StatsTournament>();
  readonly phases = new Map<string, string>();
  readonly entrantList = new Map<string, StatsEntrant>();
  readonly accounts = new Map<string, { userId: string; riotAccountId: string }>();
  readonly jobs = new Map<
    string,
    {
      requestedAt: string;
      attempts: number;
      processedAt: string | null;
      dead: boolean;
      next: Date | null;
    }
  >();
  players: StoredPlayerLine[] = [];
  teams: StoredTeamLine[] = [];
  events: { gameId: string; type: string }[] = [];
  aggregates: AggregateRow[] = [];
  champions: ChampionRow[] = [];
  teamAggregates: MatchStatsWrite['teamAggregates'][number][] = [];
  meta = new Map<string, MatchStatsWrite['championMeta'][number][]>();
  mvps: StoredMvp[] = [];
  achievementList: AchievementRecord[] = [];
  userAchievements: {
    userId: string;
    achievementId: string;
    awardedAt: Date;
    tournamentId: string;
  }[] = [];
  attached: { gameId: string; actorId: string; data: AttachGameWrite }[] = [];
  saves = 0;

  /** Puts a match in the queue, as the database trigger does. */
  request(matchId: string, at = new Date().toISOString()): void {
    this.jobs.set(matchId, {
      requestedAt: at,
      attempts: 0,
      processedAt: null,
      dead: false,
      next: null,
    });
  }

  claimJobs(limit: number) {
    return Promise.resolve(
      [...this.jobs]
        .filter(([, j]) => j.processedAt === null && !j.dead)
        .slice(0, limit)
        .map(([matchId, j]) => ({ matchId, requestedAt: j.requestedAt, attempts: j.attempts })),
    );
  }

  failJob(matchId: string, _error: string, nextAttemptAt: Date | null, dead: boolean) {
    const job = this.jobs.get(matchId);
    if (job)
      this.jobs.set(matchId, { ...job, attempts: job.attempts + 1, dead, next: nextAttemptAt });
    return Promise.resolve();
  }

  match(matchId: string) {
    return Promise.resolve(this.matches.find((m) => m.id === matchId) ?? null);
  }

  matchesOf(tournamentId: string) {
    return Promise.resolve(this.matches.filter((m) => m.tournamentId === tournamentId));
  }

  closedMatchesOfEntrants(entrantIds: readonly string[]) {
    return Promise.resolve(
      this.matches.filter(
        (m) =>
          ['completed', 'forfeit'].includes(m.status) &&
          [m.entrantA, m.entrantB].some((e) => e !== null && entrantIds.includes(e)),
      ),
    );
  }

  game(gameId: string) {
    return Promise.resolve(this.gamesList.find((g) => g.id === gameId) ?? null);
  }

  games(matchIds: readonly string[]) {
    return Promise.resolve(this.gamesList.filter((g) => matchIds.includes(g.matchId)));
  }

  tournament(tournamentId: string) {
    return Promise.resolve(this.tournamentList.get(tournamentId) ?? null);
  }

  tournaments(tournamentIds: readonly string[]) {
    return Promise.resolve(
      new Map(
        tournamentIds.flatMap((id) => {
          const t = this.tournamentList.get(id);
          return t ? [[id, t] as const] : [];
        }),
      ),
    );
  }

  tournamentBySlug(slug: string) {
    return Promise.resolve([...this.tournamentList.values()].find((t) => t.slug === slug) ?? null);
  }

  phaseNames() {
    return Promise.resolve(new Map(this.phases));
  }

  entrants(entrantIds: readonly string[]) {
    return Promise.resolve(
      new Map(
        entrantIds.flatMap((id) => {
          const e = this.entrantList.get(id);
          return e ? [[id, e] as const] : [];
        }),
      ),
    );
  }

  entrantsOfUser(userId: string) {
    return Promise.resolve(
      [...this.entrantList.values()].filter((e) => e.userIds.includes(userId)).map((e) => e.id),
    );
  }

  entrantsOfTeam(teamId: string) {
    return Promise.resolve(
      [...this.entrantList.values()].filter((e) => e.teamId === teamId).map((e) => e.id),
    );
  }

  accountsByPuuid(puuids: readonly string[]) {
    return Promise.resolve(
      new Map(
        puuids.flatMap((p) => {
          const a = this.accounts.get(p);
          return a ? [[p, a] as const] : [];
        }),
      ),
    );
  }

  playerLines(filter: Parameters<StatsRepository['playerLines']>[0]) {
    return Promise.resolve(
      this.players.filter(
        (l) =>
          (!filter.userIds || (l.userId !== null && filter.userIds.includes(l.userId))) &&
          (!filter.matchIds || filter.matchIds.includes(l.matchId)) &&
          (!filter.tournamentId || l.tournamentId === filter.tournamentId) &&
          (!filter.excludeMatchId || l.matchId !== filter.excludeMatchId),
      ),
    );
  }

  teamLines(filter: Parameters<StatsRepository['teamLines']>[0]) {
    return Promise.resolve(
      this.teams.filter(
        (l) =>
          (!filter.teamIds || (l.teamId !== null && filter.teamIds.includes(l.teamId))) &&
          (!filter.matchIds || filter.matchIds.includes(l.matchId)) &&
          (!filter.tournamentId || l.tournamentId === filter.tournamentId) &&
          (!filter.excludeMatchId || l.matchId !== filter.excludeMatchId),
      ),
    );
  }

  mvpAwards(filter: { userIds?: readonly string[]; tournamentId?: string }) {
    return Promise.resolve(
      this.mvps.filter(
        (m) =>
          (!filter.userIds || filter.userIds.includes(m.userId)) &&
          (!filter.tournamentId || m.tournamentId === filter.tournamentId),
      ),
    );
  }

  achievements(organizationId: string) {
    const byKey = new Map<string, AchievementRecord>();
    for (const a of this.achievementList.filter((x) => x.organizationId === null))
      byKey.set(a.key, a);
    for (const a of this.achievementList.filter((x) => x.organizationId === organizationId))
      byKey.set(a.key, a);
    return Promise.resolve([...byKey.values()]);
  }

  awardedKeys(userIds: readonly string[]) {
    const map = new Map<string, Set<string>>();
    for (const ua of this.userAchievements.filter((u) => userIds.includes(u.userId))) {
      const key = this.achievementList.find((a) => a.id === ua.achievementId)?.key;
      if (!key) continue;
      map.set(ua.userId, new Set([...(map.get(ua.userId) ?? []), key]));
    }
    return Promise.resolve(map);
  }

  saveMatchStats(matchId: string, requestedAt: string, data: MatchStatsWrite) {
    this.saves += 1;
    const match = this.matches.find((m) => m.id === matchId);
    if (!match) return Promise.reject(new Error('match_not_found'));
    this.players = [
      ...this.players.filter((l) => l.matchId !== matchId),
      ...data.games.flatMap((g) => g.players),
    ];
    this.teams = [
      ...this.teams.filter((l) => l.matchId !== matchId),
      ...data.games.flatMap((g) => g.teams),
    ];
    const gameIds = new Set(this.gamesList.filter((g) => g.matchId === matchId).map((g) => g.id));
    this.events = [
      ...this.events.filter((e) => !gameIds.has(e.gameId)),
      ...data.games.flatMap((g) => g.events.map((e) => ({ gameId: g.gameId, type: e.type }))),
    ];
    this.aggregates = [
      ...this.aggregates.filter(
        (a) =>
          !data.playerAggregates.some((n) => sameScope(a, n)) &&
          !data.playerAggregatesClear.some((c) => sameScope(a, c)),
      ),
      ...data.playerAggregates,
    ];
    this.champions = [
      ...this.champions.filter((c) => !data.playerChampions.scopes.some((s) => sameScope(c, s))),
      ...data.playerChampions.rows,
    ];
    this.teamAggregates = [
      ...this.teamAggregates.filter(
        (a) =>
          !data.teamAggregates.some(
            (n) => n.teamId === a.teamId && n.scopeType === a.scopeType && n.scopeId === a.scopeId,
          ),
      ),
      ...data.teamAggregates,
    ];
    this.meta.set(match.tournamentId, [...data.championMeta]);
    this.mvps = [
      ...this.mvps.filter(
        (m) => !data.mvpScopes.some((s) => s.scopeType === m.scopeType && s.scopeId === m.scopeId),
      ),
      ...data.mvpAwards.map((m) => ({
        scopeType: m.scopeType,
        scopeId: m.scopeId,
        tournamentId: match.tournamentId,
        userId: m.userId,
        score: m.score,
        games: m.games,
        awardedAt: new Date(),
      })),
    ];
    let awarded = 0;
    for (const a of data.achievements) {
      if (
        this.userAchievements.some(
          (u) => u.userId === a.userId && u.achievementId === a.achievementId,
        )
      )
        continue;
      this.userAchievements.push({
        userId: a.userId,
        achievementId: a.achievementId,
        awardedAt: new Date(),
        tournamentId: match.tournamentId,
      });
      awarded += 1;
    }
    const job = this.jobs.get(matchId);
    if (job && job.requestedAt === requestedAt)
      this.jobs.set(matchId, { ...job, processedAt: new Date().toISOString() });
    return Promise.resolve(awarded);
  }

  attachGameData(gameId: string, actorId: string, data: AttachGameWrite) {
    this.attached.push({ gameId, actorId, data });
    this.gamesList = this.gamesList.map((g) =>
      g.id === gameId
        ? {
            ...g,
            payload: data.payload,
            durationSeconds: data.durationSeconds,
            blueEntrantId: data.blueEntrantId,
            redEntrantId: data.redEntrantId,
          }
        : g,
    );
    const game = this.gamesList.find((g) => g.id === gameId);
    if (game) this.request(game.matchId);
    return Promise.resolve();
  }

  requestTournament(tournamentId: string) {
    const closed = this.matches.filter(
      (m) => m.tournamentId === tournamentId && ['completed', 'forfeit'].includes(m.status),
    );
    for (const m of closed) this.request(m.id);
    return Promise.resolve(closed.length);
  }

  playerAggregates(userId: string) {
    return Promise.resolve(this.aggregates.filter((a) => a.userId === userId));
  }

  playerAggregatesOfScope(scopeType: StatsScope, scopeId: string) {
    return Promise.resolve(
      this.aggregates.filter((a) => a.scopeType === scopeType && a.scopeId === scopeId),
    );
  }

  playerChampions(userIds: readonly string[], scopeType: StatsScope, scopeId: string | null) {
    return Promise.resolve(
      this.champions.filter(
        (c) => userIds.includes(c.userId) && c.scopeType === scopeType && c.scopeId === scopeId,
      ),
    );
  }

  teamAggregate(teamId: string): Promise<TeamAggregate | null> {
    return Promise.resolve(
      this.teamAggregates.find((a) => a.teamId === teamId && a.scopeType === 'all_time')?.stats ??
        null,
    );
  }

  championMeta(tournamentId: string) {
    return Promise.resolve(this.meta.get(tournamentId) ?? []);
  }

  achievementsOf(userId: string) {
    return Promise.resolve(
      this.userAchievements
        .filter((u) => u.userId === userId)
        .flatMap((u) => {
          const achievement = this.achievementList.find((a) => a.id === u.achievementId);
          return achievement
            ? [{ achievement, awardedAt: u.awardedAt, tournamentId: u.tournamentId }]
            : [];
        }),
    );
  }

  achievementCounts(achievementIds: readonly string[]) {
    return Promise.resolve(
      new Map(
        achievementIds.map((id) => [
          id,
          this.userAchievements.filter((u) => u.achievementId === id).length,
        ]),
      ),
    );
  }

  saveAchievement(
    organizationId: string,
    _actorId: string,
    a: Omit<AchievementRecord, 'id' | 'organizationId' | 'position'>,
  ) {
    const existing = this.achievementList.find(
      (x) => x.organizationId === organizationId && x.key === a.key,
    );
    this.achievementList = [
      ...this.achievementList.filter((x) => x !== existing),
      {
        id: existing?.id ?? `ach-${organizationId}-${a.key}`,
        organizationId,
        position: 0,
        ...a,
      },
    ];
    return Promise.resolve();
  }
}

export class InMemoryFollowRepository implements FollowRepository {
  rows: (FollowTarget & { userId: string; createdAt: Date })[] = [];

  private has(userId: string, t: FollowTarget) {
    return this.rows.some((r) => r.userId === userId && r.type === t.type && r.id === t.id);
  }

  follow(userId: string, target: FollowTarget) {
    if (!this.has(userId, target)) this.rows.push({ userId, ...target, createdAt: new Date() });
    return Promise.resolve();
  }

  unfollow(userId: string, target: FollowTarget) {
    this.rows = this.rows.filter(
      (r) => !(r.userId === userId && r.type === target.type && r.id === target.id),
    );
    return Promise.resolve();
  }

  isFollowing(userId: string, target: FollowTarget) {
    return Promise.resolve(this.has(userId, target));
  }

  followerCount(target: FollowTarget) {
    return Promise.resolve(
      this.rows.filter((r) => r.type === target.type && r.id === target.id).length,
    );
  }

  followsOf(userId: string) {
    return Promise.resolve(
      this.rows
        .filter((r) => r.userId === userId)
        .map(({ type, id, createdAt }) => ({ type, id, createdAt })),
    );
  }
}
