// Postgres adapter of StatsRepository and FollowRepository. Reads the
// competition tables the derivation starts from and the m09 tables; every
// write goes through svc_* functions (one transaction, audited where the
// docs ask for it) except follows, which are the user's own rows.
import type { AchievementCriteria, AchievementIcon } from '@league/contracts';
import type { PlayerAggregate, Radar, TeamAggregate } from '@league/core';
import type { Json, Tables } from '@league/db';

import { conflict, notFound } from '../../../shared/application-error.js';
import { assertNoError, raisedCode } from '../../../shared/database/postgres-errors.js';
import type { AdminClient } from '../../../shared/database/supabase-admin.js';
import type {
  AchievementRecord,
  AttachGameWrite,
  FollowRepository,
  FollowTarget,
  MatchStatsWrite,
  PlayerAggregateRow,
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

const PAGE = 1000;
const CHUNK = 100;

const chunks = <T>(list: readonly T[]): T[][] =>
  Array.from({ length: Math.ceil(list.length / CHUNK) }, (_, i) =>
    list.slice(i * CHUNK, (i + 1) * CHUNK),
  );

/** Reads every page of a query (PostgREST answers at most 1 000 rows). */
async function selectAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    assertNoError(error as Parameters<typeof assertNoError>[0]);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

const num = (value: number | string | null | undefined) => Number(value ?? 0);
const obj = (value: Json): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};

const toMatch = (row: Tables<'matches'>): StatsMatch => ({
  id: row.id,
  tournamentId: row.tournament_id,
  phaseId: row.phase_id,
  round: row.round,
  status: row.status,
  entrantA: row.entrant_a_id,
  entrantB: row.entrant_b_id,
  winnerId: row.winner_entrant_id,
  scoreA: row.score_a,
  scoreB: row.score_b,
  finalizedAt: row.finalized_at ? new Date(row.finalized_at) : null,
});

const toGame = (row: Tables<'games'>): StatsGame => ({
  id: row.id,
  matchId: row.match_id,
  number: row.game_number,
  status: row.status,
  blueEntrantId: row.blue_entrant_id,
  redEntrantId: row.red_entrant_id,
  winnerEntrantId: row.winner_entrant_id,
  endedAt: row.ended_at ? new Date(row.ended_at) : null,
  durationSeconds: row.duration_seconds,
  payload: row.raw_match_payload,
});

function toPlayerLine(row: Tables<'player_game_stats'>): StoredPlayerLine {
  const objectives = obj(row.objectives);
  const multikills = obj((objectives['multikills'] ?? {}) as Json);
  const runes = obj(row.runes);
  const n = (v: unknown) => (typeof v === 'number' ? v : 0);
  const id = (v: unknown) => (typeof v === 'number' ? v : null);
  return {
    gameId: row.game_id,
    matchId: row.match_id,
    tournamentId: row.tournament_id,
    playedAt: new Date(row.played_at).toISOString(),
    puuid: row.puuid,
    userId: row.user_id,
    entrantId: row.entrant_id,
    side: row.side,
    championId: row.champion_id,
    role: row.game_role,
    win: row.win,
    durationSeconds: row.duration_seconds,
    kills: row.kills,
    deaths: row.deaths,
    assists: row.assists,
    kda: num(row.kda),
    cs: row.cs,
    csPerMin: num(row.cs_per_min),
    gold: row.gold,
    goldPerMin: num(row.gold_per_min),
    damageToChampions: row.damage_to_champions,
    damagePerMin: num(row.damage_per_min),
    damageShare: num(row.damage_share),
    damageTaken: row.damage_taken,
    visionScore: row.vision_score,
    visionPerMin: num(row.vision_per_min),
    wardsPlaced: row.wards_placed,
    wardsKilled: row.wards_killed,
    killParticipation: num(row.kill_participation),
    firstBloodKill: row.first_blood,
    turretKills: n(objectives['turrets']),
    dragonKills: n(objectives['dragons']),
    baronKills: n(objectives['barons']),
    doubleKills: n(multikills['double']),
    tripleKills: n(multikills['triple']),
    quadraKills: n(multikills['quadra']),
    pentaKills: n(multikills['penta']),
    items: Array.isArray(row.items)
      ? row.items.filter((i): i is number => typeof i === 'number')
      : [],
    runes: {
      keystone: id(runes['keystone']),
      primaryStyle: id(runes['primaryStyle']),
      secondaryStyle: id(runes['secondaryStyle']),
    },
    score: num(row.score),
    isMvp: row.is_mvp,
  };
}

function toTeamLine(row: Tables<'team_game_stats'>): StoredTeamLine {
  const firsts = obj(row.first_objectives);
  return {
    gameId: row.game_id,
    matchId: row.match_id,
    tournamentId: row.tournament_id,
    teamId: row.team_id,
    playedAt: new Date(row.played_at).toISOString(),
    entrantId: row.entrant_id,
    side: row.side,
    win: row.win,
    durationSeconds: row.duration_seconds,
    kills: row.kills,
    gold: row.gold,
    towers: row.towers,
    dragons: row.dragons,
    barons: row.barons,
    heralds: row.heralds,
    grubs: row.grubs,
    inhibitors: row.inhibitors,
    firstBlood: firsts['blood'] === true,
    firstTower: firsts['tower'] === true,
    firstDragon: firsts['dragon'] === true,
    firstBaron: firsts['baron'] === true,
    bans: row.bans,
  };
}

const toAggregate = (row: Tables<'player_aggregate_stats'>): PlayerAggregate => ({
  games: row.games,
  wins: row.wins,
  kills: row.kills,
  deaths: row.deaths,
  assists: row.assists,
  kda: num(row.kda),
  avgCsPerMin: num(row.avg_cs_per_min),
  avgGoldPerMin: num(row.avg_gold_per_min),
  avgDamagePerMin: num(row.avg_damage_per_min),
  avgVisionPerMin: num(row.avg_vision),
  avgKillParticipation: num(row.avg_kp),
  avgDamageShare: num(row.avg_damage_share),
  avgScore: num(row.avg_score),
  mvps: row.mvps,
  radar: row.radar as unknown as Radar,
});

const toAchievement = (row: Tables<'achievements'>): AchievementRecord => ({
  id: row.id,
  organizationId: row.organization_id,
  key: row.key,
  name: row.name,
  description: row.description,
  icon: row.icon as AchievementIcon,
  criteria: row.criteria as unknown as AchievementCriteria,
  active: row.is_active,
  position: row.position,
});

const toMvp = (row: Tables<'mvp_awards'>): StoredMvp => ({
  scopeType: row.scope_type,
  scopeId: row.scope_id,
  tournamentId: row.tournament_id,
  userId: row.user_id,
  score: num(row.score),
  games: row.games,
  awardedAt: new Date(row.awarded_at),
});

const scopeFilter = <Q extends { is(c: string, v: null): Q; eq(c: string, v: string): Q }>(
  query: Q,
  scopeId: string | null,
) => (scopeId === null ? query.is('scope_id', null) : query.eq('scope_id', scopeId));

export class SupabaseStatsRepository implements StatsRepository {
  constructor(private readonly db: AdminClient) {}

  // Queue -------------------------------------------------------------------------
  async claimJobs(limit: number, leaseSeconds: number) {
    const { data, error } = await this.db.rpc('svc_claim_stats_jobs', {
      p_limit: limit,
      p_lease_seconds: leaseSeconds,
    });
    assertNoError(error);
    return (data ?? []).map((j) => ({
      matchId: j.match_id,
      requestedAt: j.requested_at,
      attempts: j.attempts,
    }));
  }

  async failJob(matchId: string, error: string, nextAttemptAt: Date | null, dead: boolean) {
    const { error: dbError } = await this.db.rpc('svc_fail_stats_job', {
      p_match_id: matchId,
      p_error: error,
      p_next_attempt_at: (nextAttemptAt ?? new Date()).toISOString(),
      p_dead: dead,
    });
    assertNoError(dbError);
  }

  // Competition facts ------------------------------------------------------------------
  async match(matchId: string) {
    const { data, error } = await this.db
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .maybeSingle();
    assertNoError(error);
    return data ? toMatch(data) : null;
  }

  async matchesOf(tournamentId: string) {
    const rows = await selectAll((from, to) =>
      this.db.from('matches').select('*').eq('tournament_id', tournamentId).range(from, to),
    );
    return rows.map(toMatch);
  }

  async closedMatchesOfEntrants(entrantIds: readonly string[]) {
    const out: StatsMatch[] = [];
    for (const ids of chunks(entrantIds)) {
      const list = ids.join(',');
      const rows = await selectAll((from, to) =>
        this.db
          .from('matches')
          .select('*')
          .in('status', ['completed', 'forfeit'])
          .or(`entrant_a_id.in.(${list}),entrant_b_id.in.(${list})`)
          .range(from, to),
      );
      out.push(...rows.map(toMatch));
    }
    return [...new Map(out.map((m) => [m.id, m])).values()];
  }

  async game(gameId: string) {
    const { data, error } = await this.db.from('games').select('*').eq('id', gameId).maybeSingle();
    assertNoError(error);
    return data ? toGame(data) : null;
  }

  async games(matchIds: readonly string[]) {
    const out: StatsGame[] = [];
    for (const ids of chunks(matchIds)) {
      const { data, error } = await this.db.from('games').select('*').in('match_id', ids);
      assertNoError(error);
      out.push(...(data ?? []).map(toGame));
    }
    return out;
  }

  async tournaments(tournamentIds: readonly string[]) {
    const map = new Map<string, StatsTournament>();
    for (const ids of chunks(tournamentIds)) {
      const [{ data, error }, circuits] = await Promise.all([
        this.db
          .from('tournaments')
          .select('id, organization_id, slug, name, status, season_id, visibility, deleted_at')
          .in('id', ids),
        this.db
          .from('circuit_tournaments')
          .select('circuit_id, tournament_id')
          .in('tournament_id', ids),
      ]);
      assertNoError(error);
      assertNoError(circuits.error);
      const circuitOf = new Map((circuits.data ?? []).map((c) => [c.tournament_id, c.circuit_id]));
      for (const t of data ?? [])
        map.set(t.id, {
          id: t.id,
          organizationId: t.organization_id,
          slug: t.slug,
          name: t.name,
          status: t.status,
          seasonId: t.season_id,
          circuitId: circuitOf.get(t.id) ?? null,
          isPublic: t.deleted_at === null && t.status !== 'draft' && t.visibility !== 'private',
        });
    }
    return map;
  }

  async tournament(tournamentId: string) {
    return (await this.tournaments([tournamentId])).get(tournamentId) ?? null;
  }

  async tournamentBySlug(slug: string) {
    const { data, error } = await this.db
      .from('tournaments')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .maybeSingle();
    assertNoError(error);
    return data ? this.tournament(data.id) : null;
  }

  async phaseNames(tournamentId: string) {
    const { data, error } = await this.db
      .from('phases')
      .select('id, name')
      .eq('tournament_id', tournamentId);
    assertNoError(error);
    return new Map((data ?? []).map((p) => [p.id, p.name]));
  }

  async entrants(entrantIds: readonly string[]) {
    const map = new Map<string, StatsEntrant>();
    for (const ids of chunks([...new Set(entrantIds)])) {
      const [entrants, roster] = await Promise.all([
        this.db.from('entrants').select('id, display_name, team_id, user_id').in('id', ids),
        this.db
          .from('entrant_roster_members')
          .select('entrant_id, user_id')
          .in('entrant_id', ids)
          .is('removed_at', null),
      ]);
      assertNoError(entrants.error);
      assertNoError(roster.error);
      for (const e of entrants.data ?? [])
        map.set(e.id, {
          id: e.id,
          name: e.display_name,
          teamId: e.team_id,
          userIds: [
            ...new Set([
              ...(e.user_id ? [e.user_id] : []),
              ...(roster.data ?? []).filter((r) => r.entrant_id === e.id).map((r) => r.user_id),
            ]),
          ],
        });
    }
    return map;
  }

  async entrantsOfUser(userId: string) {
    const [roster, solo] = await Promise.all([
      this.db.from('entrant_roster_members').select('entrant_id').eq('user_id', userId),
      this.db.from('entrants').select('id').eq('user_id', userId),
    ]);
    assertNoError(roster.error);
    assertNoError(solo.error);
    return [
      ...new Set([
        ...(roster.data ?? []).map((r) => r.entrant_id),
        ...(solo.data ?? []).map((e) => e.id),
      ]),
    ];
  }

  async entrantsOfTeam(teamId: string) {
    const { data, error } = await this.db.from('entrants').select('id').eq('team_id', teamId);
    assertNoError(error);
    return (data ?? []).map((e) => e.id);
  }

  async accountsByPuuid(puuids: readonly string[]) {
    const map = new Map<string, { userId: string; riotAccountId: string }>();
    for (const ids of chunks([...new Set(puuids)])) {
      const { data, error } = await this.db
        .from('riot_accounts')
        .select('id, user_id, puuid, unlinked_at')
        .in('puuid', ids);
      assertNoError(error);
      // The current link wins over a past one.
      for (const a of [...(data ?? [])].sort(
        (x, y) => Number(x.unlinked_at === null) - Number(y.unlinked_at === null),
      ))
        map.set(a.puuid, { userId: a.user_id, riotAccountId: a.id });
    }
    return map;
  }

  // Stats ------------------------------------------------------------------------------
  async playerLines(filter: Parameters<StatsRepository['playerLines']>[0]) {
    if (filter.userIds?.length === 0 || filter.matchIds?.length === 0) return [];
    const groups = filter.userIds
      ? chunks(filter.userIds)
      : filter.matchIds
        ? chunks(filter.matchIds)
        : [[]];
    const out: StoredPlayerLine[] = [];
    for (const ids of groups) {
      const rows = await selectAll((from, to) => {
        let q = this.db.from('player_game_stats').select('*');
        if (filter.userIds) q = q.in('user_id', ids);
        else if (filter.matchIds) q = q.in('match_id', ids);
        if (filter.tournamentId) q = q.eq('tournament_id', filter.tournamentId);
        if (filter.excludeMatchId) q = q.neq('match_id', filter.excludeMatchId);
        return q.order('id').range(from, to);
      });
      out.push(...rows.map(toPlayerLine));
    }
    return out;
  }

  async teamLines(filter: Parameters<StatsRepository['teamLines']>[0]) {
    if (filter.teamIds?.length === 0 || filter.matchIds?.length === 0) return [];
    const groups = filter.teamIds
      ? chunks(filter.teamIds)
      : filter.matchIds
        ? chunks(filter.matchIds)
        : [[]];
    const out: StoredTeamLine[] = [];
    for (const ids of groups) {
      const rows = await selectAll((from, to) => {
        let q = this.db.from('team_game_stats').select('*');
        if (filter.teamIds) q = q.in('team_id', ids);
        else if (filter.matchIds) q = q.in('match_id', ids);
        if (filter.tournamentId) q = q.eq('tournament_id', filter.tournamentId);
        if (filter.excludeMatchId) q = q.neq('match_id', filter.excludeMatchId);
        return q.order('id').range(from, to);
      });
      out.push(...rows.map(toTeamLine));
    }
    return out;
  }

  async mvpAwards(filter: { userIds?: readonly string[]; tournamentId?: string }) {
    if (filter.userIds?.length === 0) return [];
    let q = this.db.from('mvp_awards').select('*');
    if (filter.userIds) q = q.in('user_id', [...filter.userIds]);
    if (filter.tournamentId) q = q.eq('tournament_id', filter.tournamentId);
    const { data, error } = await q.order('awarded_at', { ascending: false }).limit(1000);
    assertNoError(error);
    return (data ?? []).map(toMvp);
  }

  async achievements(organizationId: string) {
    const { data, error } = await this.db
      .from('achievements')
      .select('*')
      .or(`organization_id.is.null,organization_id.eq.${organizationId}`);
    assertNoError(error);
    // The organization's own rule replaces the platform one with the same key.
    const byKey = new Map<string, AchievementRecord>();
    for (const a of (data ?? [])
      .map(toAchievement)
      .sort((x, y) => Number(x.organizationId !== null) - Number(y.organizationId !== null)))
      byKey.set(a.key, a);
    return [...byKey.values()].sort(
      (a, b) => a.position - b.position || a.key.localeCompare(b.key),
    );
  }

  async awardedKeys(userIds: readonly string[]) {
    const map = new Map<string, Set<string>>();
    for (const ids of chunks(userIds)) {
      const { data, error } = await this.db
        .from('user_achievements')
        .select('user_id, achievements(key)')
        .in('user_id', ids);
      assertNoError(error);
      for (const row of data ?? []) {
        const set = map.get(row.user_id) ?? new Set<string>();
        set.add(row.achievements.key);
        map.set(row.user_id, set);
      }
    }
    return map;
  }

  async saveMatchStats(matchId: string, requestedAt: string, data: MatchStatsWrite) {
    const scope = (s: { scopeType: StatsScope; scopeId: string | null }) => ({
      scope_type: s.scopeType,
      scope_id: s.scopeId,
    });
    const aggregate = (a: PlayerAggregate) => ({
      games: a.games,
      wins: a.wins,
      kills: a.kills,
      deaths: a.deaths,
      assists: a.assists,
      kda: a.kda,
      avg_cs_per_min: a.avgCsPerMin,
      avg_gold_per_min: a.avgGoldPerMin,
      avg_damage_per_min: a.avgDamagePerMin,
      avg_vision: a.avgVisionPerMin,
      avg_kp: a.avgKillParticipation,
      avg_damage_share: a.avgDamageShare,
      avg_score: a.avgScore,
      mvps: a.mvps,
      radar: a.radar,
    });
    const team = (a: TeamAggregate) => ({
      games: a.games,
      wins: a.wins,
      avg_game_duration: a.avgDurationSeconds,
      avg_kills: a.avgKills,
      avg_towers: a.avgTowers,
      avg_dragons: a.avgDragons,
      avg_barons: a.avgBarons,
      first_blood_rate: a.firstBloodRate,
      first_tower_rate: a.firstTowerRate,
    });
    const payload = {
      games: data.games.map((g) => ({
        game_id: g.gameId,
        players: g.players.map((l) => ({
          user_id: l.userId,
          puuid: l.puuid,
          entrant_id: l.entrantId,
          side: l.side,
          champion_id: l.championId,
          game_role: l.role,
          win: l.win,
          duration_seconds: l.durationSeconds,
          played_at: l.playedAt,
          kills: l.kills,
          deaths: l.deaths,
          assists: l.assists,
          kda: l.kda,
          cs: l.cs,
          cs_per_min: l.csPerMin,
          gold: l.gold,
          gold_per_min: l.goldPerMin,
          damage_to_champions: l.damageToChampions,
          damage_per_min: l.damagePerMin,
          damage_share: l.damageShare,
          damage_taken: l.damageTaken,
          vision_score: l.visionScore,
          vision_per_min: l.visionPerMin,
          wards_placed: l.wardsPlaced,
          wards_killed: l.wardsKilled,
          kill_participation: l.killParticipation,
          first_blood: l.firstBloodKill,
          objectives: {
            turrets: l.turretKills,
            dragons: l.dragonKills,
            barons: l.baronKills,
            multikills: {
              double: l.doubleKills,
              triple: l.tripleKills,
              quadra: l.quadraKills,
              penta: l.pentaKills,
            },
          },
          items: l.items,
          runes: l.runes,
          score: l.score,
          is_mvp: l.isMvp,
        })),
        teams: g.teams.map((t) => ({
          entrant_id: t.entrantId,
          team_id: t.teamId,
          side: t.side,
          win: t.win,
          duration_seconds: t.durationSeconds,
          played_at: t.playedAt,
          kills: t.kills,
          gold: t.gold,
          towers: t.towers,
          dragons: t.dragons,
          barons: t.barons,
          heralds: t.heralds,
          grubs: t.grubs,
          inhibitors: t.inhibitors,
          first_objectives: {
            blood: t.firstBlood,
            tower: t.firstTower,
            dragon: t.firstDragon,
            baron: t.firstBaron,
          },
          bans: t.bans,
        })),
        events: g.events.map((e) => ({ type: e.type, actor_puuid: e.actorPuuid, side: e.side })),
      })),
      player_aggregates: data.playerAggregates.map((a) => ({
        user_id: a.userId,
        ...scope(a),
        ...aggregate(a.stats),
      })),
      player_aggregates_clear: data.playerAggregatesClear.map((a) => ({
        user_id: a.userId,
        ...scope(a),
      })),
      player_champions: {
        scopes: data.playerChampions.scopes.map((s) => ({ user_id: s.userId, ...scope(s) })),
        rows: data.playerChampions.rows.map((r) => ({
          user_id: r.userId,
          ...scope(r),
          champion_id: r.championId,
          games: r.games,
          wins: r.wins,
          kills: r.kills,
          deaths: r.deaths,
          assists: r.assists,
          kda: r.kda,
        })),
      },
      team_aggregates: data.teamAggregates.map((a) => ({
        team_id: a.teamId,
        ...scope(a),
        ...team(a.stats),
      })),
      champion_meta: data.championMeta.map((m) => ({
        champion_id: m.championId,
        picks: m.picks,
        bans: m.bans,
        wins: m.wins,
      })),
      mvp_scopes: data.mvpScopes.map((s) => ({ scope_type: s.scopeType, scope_id: s.scopeId })),
      mvp_awards: data.mvpAwards.map((m) => ({
        scope_type: m.scopeType,
        scope_id: m.scopeId,
        user_id: m.userId,
        entrant_id: m.entrantId,
        score: m.score,
        games: m.games,
      })),
      achievements: data.achievements.map((a) => ({
        user_id: a.userId,
        achievement_id: a.achievementId,
        context: a.context,
      })),
    };
    const { data: awarded, error } = await this.db.rpc('svc_save_match_stats', {
      p_match_id: matchId,
      p_requested_at: requestedAt,
      p_data: payload as unknown as Json,
    });
    assertNoError(error);
    return awarded ?? 0;
  }

  async attachGameData(gameId: string, actorId: string, data: AttachGameWrite) {
    const { error } = await this.db.rpc('svc_attach_game_data', {
      p_game_id: gameId,
      p_actor: actorId,
      p_game: {
        payload: data.payload as Json,
        duration_seconds: data.durationSeconds,
        patch: data.patch,
        riot_match_id: data.riotMatchId,
        blue_entrant_id: data.blueEntrantId,
        red_entrant_id: data.redEntrantId,
      },
      p_participants: data.participants.map((p) => ({
        entrant_id: p.entrantId,
        user_id: p.userId,
        riot_account_id: p.riotAccountId,
        puuid: p.puuid,
        side: p.side,
        game_role: p.role,
        champion_id: p.championId,
        is_expected: p.isExpected,
      })),
      p_draft: data.draft.map((d) => ({
        entrant_id: d.entrantId,
        action: d.action,
        champion_id: d.championId,
        sequence: d.sequence,
        side: d.side,
      })),
    });
    const code = raisedCode(error);
    if (code === 'game_not_found') throw notFound(code);
    if (code === 'game_not_completed') throw conflict(code);
    assertNoError(error);
  }

  async requestTournament(tournamentId: string, actorId: string) {
    const { data, error } = await this.db.rpc('svc_request_tournament_stats', {
      p_tournament_id: tournamentId,
      p_actor: actorId,
    });
    if (raisedCode(error) === 'tournament_not_found') throw notFound('tournament_not_found');
    assertNoError(error);
    return data ?? 0;
  }

  // Reads of the public pages ----------------------------------------------------------------
  async playerAggregates(userId: string): Promise<PlayerAggregateRow[]> {
    const { data, error } = await this.db
      .from('player_aggregate_stats')
      .select('*')
      .eq('user_id', userId);
    assertNoError(error);
    return (data ?? []).map((r) => ({
      scopeType: r.scope_type,
      scopeId: r.scope_id,
      stats: toAggregate(r),
    }));
  }

  async playerAggregatesOfScope(scopeType: StatsScope, scopeId: string) {
    const rows = await selectAll((from, to) =>
      this.db
        .from('player_aggregate_stats')
        .select('*')
        .eq('scope_type', scopeType)
        .eq('scope_id', scopeId)
        .order('id')
        .range(from, to),
    );
    return rows.map((r) => ({
      userId: r.user_id,
      scopeType: r.scope_type,
      scopeId: r.scope_id,
      stats: toAggregate(r),
    }));
  }

  async playerChampions(userIds: readonly string[], scopeType: StatsScope, scopeId: string | null) {
    if (userIds.length === 0) return [];
    const rows = await selectAll((from, to) =>
      scopeFilter(
        this.db
          .from('player_champion_stats')
          .select('*')
          .in('user_id', [...userIds])
          .eq('scope_type', scopeType),
        scopeId,
      )
        .order('id')
        .range(from, to),
    );
    return rows.map((r) => ({
      userId: r.user_id,
      scopeType: r.scope_type,
      scopeId: r.scope_id,
      championId: r.champion_id,
      games: r.games,
      wins: r.wins,
      kills: r.kills,
      deaths: r.deaths,
      assists: r.assists,
      kda: num(r.kda),
    }));
  }

  async teamAggregate(teamId: string): Promise<TeamAggregate | null> {
    const { data, error } = await this.db
      .from('team_aggregate_stats')
      .select('*')
      .eq('team_id', teamId)
      .eq('scope_type', 'all_time')
      .maybeSingle();
    assertNoError(error);
    return data
      ? {
          games: data.games,
          wins: data.wins,
          avgDurationSeconds: data.avg_game_duration,
          avgKills: num(data.avg_kills),
          avgTowers: num(data.avg_towers),
          avgDragons: num(data.avg_dragons),
          avgBarons: num(data.avg_barons),
          firstBloodRate: num(data.first_blood_rate),
          firstTowerRate: num(data.first_tower_rate),
        }
      : null;
  }

  async championMeta(tournamentId: string) {
    const { data, error } = await this.db
      .from('champion_meta_stats')
      .select('champion_id, picks, bans, wins')
      .eq('tournament_id', tournamentId);
    assertNoError(error);
    return (data ?? [])
      .map((m) => ({ championId: m.champion_id, picks: m.picks, bans: m.bans, wins: m.wins }))
      .sort(
        (a, b) =>
          b.picks + b.bans - (a.picks + a.bans) || b.picks - a.picks || a.championId - b.championId,
      );
  }

  async achievementsOf(userId: string) {
    const { data, error } = await this.db
      .from('user_achievements')
      .select('awarded_at, tournament_id, achievements(*)')
      .eq('user_id', userId)
      .order('awarded_at', { ascending: false });
    assertNoError(error);
    return (data ?? []).map((r) => ({
      achievement: toAchievement(r.achievements),
      awardedAt: new Date(r.awarded_at),
      tournamentId: r.tournament_id,
    }));
  }

  async achievementCounts(achievementIds: readonly string[]) {
    const counts = new Map<string, number>();
    for (const ids of chunks(achievementIds)) {
      const rows = await selectAll((from, to) =>
        this.db
          .from('user_achievements')
          .select('achievement_id')
          .in('achievement_id', ids)
          .order('achievement_id')
          .range(from, to),
      );
      for (const r of rows) counts.set(r.achievement_id, (counts.get(r.achievement_id) ?? 0) + 1);
    }
    return counts;
  }

  async saveAchievement(
    organizationId: string,
    actorId: string,
    a: Omit<AchievementRecord, 'id' | 'organizationId' | 'position'>,
  ) {
    const { error } = await this.db.rpc('svc_save_achievement', {
      p_organization_id: organizationId,
      p_actor: actorId,
      p_key: a.key,
      p_name: a.name,
      p_description: a.description,
      p_icon: a.icon,
      p_criteria: a.criteria as unknown as Json,
      p_active: a.active,
    });
    assertNoError(error);
  }
}

export class SupabaseFollowRepository implements FollowRepository {
  constructor(private readonly db: AdminClient) {}

  async follow(userId: string, target: FollowTarget) {
    const { error } = await this.db
      .from('follows')
      .upsert(
        { follower_user_id: userId, followable_type: target.type, followable_id: target.id },
        { onConflict: 'follower_user_id,followable_type,followable_id', ignoreDuplicates: true },
      );
    assertNoError(error);
  }

  async unfollow(userId: string, target: FollowTarget) {
    const { error } = await this.db
      .from('follows')
      .delete()
      .eq('follower_user_id', userId)
      .eq('followable_type', target.type)
      .eq('followable_id', target.id);
    assertNoError(error);
  }

  async isFollowing(userId: string, target: FollowTarget) {
    const { count, error } = await this.db
      .from('follows')
      .select('follower_user_id', { count: 'exact', head: true })
      .eq('follower_user_id', userId)
      .eq('followable_type', target.type)
      .eq('followable_id', target.id);
    assertNoError(error);
    return (count ?? 0) > 0;
  }

  async followerCount(target: FollowTarget) {
    const { count, error } = await this.db
      .from('follows')
      .select('follower_user_id', { count: 'exact', head: true })
      .eq('followable_type', target.type)
      .eq('followable_id', target.id);
    assertNoError(error);
    return count ?? 0;
  }

  async followsOf(userId: string) {
    const { data, error } = await this.db
      .from('follows')
      .select('followable_type, followable_id, created_at')
      .eq('follower_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(500);
    assertNoError(error);
    return (data ?? []).flatMap((f) =>
      f.followable_type === 'organization'
        ? []
        : [
            {
              type: f.followable_type,
              id: f.followable_id,
              createdAt: new Date(f.created_at),
            },
          ],
    );
  }
}
