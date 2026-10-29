// What the stats use cases need from the database. Reads and writes of the
// m09 tables, plus the competition facts (matches, games, rosters) the
// derivation starts from.

import type {
  AchievementCriteria,
  AchievementIcon,
  FollowableType,
  MvpScope,
} from '@league/contracts';
import type { HistoryLine, PlayerAggregate, TeamAggregate, TeamGameLine } from '@league/core';

export type StatsScope = 'tournament' | 'circuit' | 'season' | 'all_time';

export interface StatsMatch {
  readonly id: string;
  readonly tournamentId: string;
  readonly phaseId: string;
  readonly round: number;
  readonly status: string;
  readonly entrantA: string | null;
  readonly entrantB: string | null;
  readonly winnerId: string | null;
  readonly scoreA: number;
  readonly scoreB: number;
  readonly finalizedAt: Date | null;
}

export interface StatsGame {
  readonly id: string;
  readonly matchId: string;
  readonly number: number;
  readonly status: string;
  readonly blueEntrantId: string;
  readonly redEntrantId: string;
  readonly winnerEntrantId: string | null;
  readonly endedAt: Date | null;
  readonly durationSeconds: number | null;
  readonly payload: unknown;
}

export interface StatsTournament {
  readonly id: string;
  readonly organizationId: string;
  readonly slug: string;
  readonly name: string;
  readonly status: string;
  readonly seasonId: string | null;
  readonly circuitId: string | null;
  /** Published and visible on the public site. */
  readonly isPublic: boolean;
}

export interface StatsEntrant {
  readonly id: string;
  readonly name: string;
  readonly teamId: string | null;
  /** Active roster (and the solo player of a solo registration). */
  readonly userIds: readonly string[];
}

/** A stored game line of a player, with where it was played. */
export interface StoredPlayerLine extends HistoryLine {
  readonly matchId: string;
  readonly tournamentId: string;
}

export interface StoredTeamLine extends TeamGameLine {
  readonly gameId: string;
  readonly matchId: string;
  readonly tournamentId: string;
  readonly teamId: string | null;
  readonly playedAt: string;
}

export interface StoredMvp {
  readonly scopeType: MvpScope;
  readonly scopeId: string;
  readonly tournamentId: string;
  readonly userId: string;
  readonly score: number;
  readonly games: number;
  readonly awardedAt: Date;
}

export interface AchievementRecord {
  readonly id: string;
  readonly organizationId: string | null;
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly icon: AchievementIcon;
  readonly criteria: AchievementCriteria;
  readonly active: boolean;
  readonly position: number;
}

/** Everything one recalculation writes (svc_save_match_stats). */
export interface MatchStatsWrite {
  readonly games: readonly {
    readonly gameId: string;
    readonly players: readonly StoredPlayerLine[];
    readonly teams: readonly StoredTeamLine[];
    readonly events: readonly {
      readonly type: string;
      readonly actorPuuid: string | null;
      readonly side: 'blue' | 'red';
    }[];
  }[];
  readonly playerAggregates: readonly {
    readonly userId: string;
    readonly scopeType: StatsScope;
    readonly scopeId: string | null;
    readonly stats: PlayerAggregate;
  }[];
  readonly playerAggregatesClear: readonly {
    readonly userId: string;
    readonly scopeType: StatsScope;
    readonly scopeId: string | null;
  }[];
  readonly playerChampions: {
    readonly scopes: readonly {
      readonly userId: string;
      readonly scopeType: StatsScope;
      readonly scopeId: string | null;
    }[];
    readonly rows: readonly {
      readonly userId: string;
      readonly scopeType: StatsScope;
      readonly scopeId: string | null;
      readonly championId: number;
      readonly games: number;
      readonly wins: number;
      readonly kills: number;
      readonly deaths: number;
      readonly assists: number;
      readonly kda: number;
    }[];
  };
  readonly teamAggregates: readonly {
    readonly teamId: string;
    readonly scopeType: StatsScope;
    readonly scopeId: string | null;
    readonly stats: TeamAggregate;
  }[];
  readonly championMeta: readonly {
    readonly championId: number;
    readonly picks: number;
    readonly bans: number;
    readonly wins: number;
  }[];
  readonly mvpScopes: readonly { readonly scopeType: MvpScope; readonly scopeId: string }[];
  readonly mvpAwards: readonly {
    readonly scopeType: MvpScope;
    readonly scopeId: string;
    readonly userId: string;
    readonly entrantId: string | null;
    readonly score: number;
    readonly games: number;
  }[];
  readonly achievements: readonly {
    readonly userId: string;
    readonly achievementId: string;
    readonly context: Readonly<Record<string, unknown>>;
  }[];
}

export interface AttachGameWrite {
  readonly payload: unknown;
  readonly durationSeconds: number;
  readonly patch: string | null;
  readonly riotMatchId: string | null;
  readonly blueEntrantId: string;
  readonly redEntrantId: string;
  readonly participants: readonly {
    readonly entrantId: string;
    readonly userId: string | null;
    readonly riotAccountId: string | null;
    readonly puuid: string;
    readonly side: 'blue' | 'red';
    readonly role: string | null;
    readonly championId: number;
    readonly isExpected: boolean;
  }[];
  readonly draft: readonly {
    readonly entrantId: string;
    readonly action: 'pick' | 'ban';
    readonly championId: number;
    readonly sequence: number;
    readonly side: 'blue' | 'red';
  }[];
}

export interface PlayerAggregateRow {
  readonly scopeType: StatsScope;
  readonly scopeId: string | null;
  readonly stats: PlayerAggregate;
}

export interface StatsRepository {
  // Queue -------------------------------------------------------------------
  claimJobs(
    limit: number,
    leaseSeconds: number,
  ): Promise<{ matchId: string; requestedAt: string; attempts: number }[]>;
  failJob(matchId: string, error: string, nextAttemptAt: Date | null, dead: boolean): Promise<void>;

  // Competition facts -----------------------------------------------------------
  match(matchId: string): Promise<StatsMatch | null>;
  matchesOf(tournamentId: string): Promise<StatsMatch[]>;
  /** Closed matches (completed or forfeit) where any of the registrations played. */
  closedMatchesOfEntrants(entrantIds: readonly string[]): Promise<StatsMatch[]>;
  game(gameId: string): Promise<StatsGame | null>;
  games(matchIds: readonly string[]): Promise<StatsGame[]>;
  tournament(tournamentId: string): Promise<StatsTournament | null>;
  tournaments(tournamentIds: readonly string[]): Promise<Map<string, StatsTournament>>;
  tournamentBySlug(slug: string): Promise<StatsTournament | null>;
  phaseNames(tournamentId: string): Promise<Map<string, string>>;
  entrants(entrantIds: readonly string[]): Promise<Map<string, StatsEntrant>>;
  /** Registrations the user played for (roster or solo). */
  entrantsOfUser(userId: string): Promise<string[]>;
  entrantsOfTeam(teamId: string): Promise<string[]>;
  /** Who each PUUID belongs to (any linked account, also past ones). */
  accountsByPuuid(
    puuids: readonly string[],
  ): Promise<Map<string, { userId: string; riotAccountId: string }>>;

  // Stats ------------------------------------------------------------------------
  playerLines(filter: {
    readonly userIds?: readonly string[];
    readonly tournamentId?: string;
    readonly matchIds?: readonly string[];
    readonly excludeMatchId?: string;
  }): Promise<StoredPlayerLine[]>;
  teamLines(filter: {
    readonly teamIds?: readonly string[];
    readonly tournamentId?: string;
    readonly matchIds?: readonly string[];
    readonly excludeMatchId?: string;
  }): Promise<StoredTeamLine[]>;
  mvpAwards(filter: {
    readonly userIds?: readonly string[];
    readonly tournamentId?: string;
  }): Promise<StoredMvp[]>;
  /** Active platform rules plus the organization's (its own override a platform one by key). */
  achievements(organizationId: string): Promise<AchievementRecord[]>;
  /** Keys of the achievements each user has. */
  awardedKeys(userIds: readonly string[]): Promise<Map<string, Set<string>>>;
  saveMatchStats(matchId: string, requestedAt: string, data: MatchStatsWrite): Promise<number>;
  attachGameData(gameId: string, actorId: string, data: AttachGameWrite): Promise<void>;
  requestTournament(tournamentId: string, actorId: string): Promise<number>;

  // Reads of the public pages ---------------------------------------------------------
  playerAggregates(userId: string): Promise<PlayerAggregateRow[]>;
  playerAggregatesOfScope(
    scopeType: StatsScope,
    scopeId: string,
  ): Promise<(PlayerAggregateRow & { userId: string })[]>;
  playerChampions(
    userIds: readonly string[],
    scopeType: StatsScope,
    scopeId: string | null,
  ): Promise<MatchStatsWrite['playerChampions']['rows'][number][]>;
  teamAggregate(teamId: string): Promise<TeamAggregate | null>;
  championMeta(tournamentId: string): Promise<MatchStatsWrite['championMeta'][number][]>;
  achievementsOf(
    userId: string,
  ): Promise<{ achievement: AchievementRecord; awardedAt: Date; tournamentId: string | null }[]>;
  achievementCounts(achievementIds: readonly string[]): Promise<Map<string, number>>;
  saveAchievement(
    organizationId: string,
    actorId: string,
    achievement: Omit<AchievementRecord, 'id' | 'organizationId' | 'position'>,
  ): Promise<void>;
}

export interface FollowTarget {
  readonly type: FollowableType;
  readonly id: string;
}

export interface FollowRepository {
  follow(userId: string, target: FollowTarget): Promise<void>;
  unfollow(userId: string, target: FollowTarget): Promise<void>;
  isFollowing(userId: string, target: FollowTarget): Promise<boolean>;
  followerCount(target: FollowTarget): Promise<number>;
  followsOf(userId: string): Promise<(FollowTarget & { createdAt: Date })[]>;
}

/** Champion names and icons (Data Dragon). */
export interface ChampionDirectory {
  champions(): Promise<ReadonlyMap<number, { id: number; name: string; iconUrl: string | null }>>;
}
