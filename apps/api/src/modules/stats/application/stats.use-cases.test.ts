import { describe, expect, it } from 'vitest';

import { demoMatchData } from '../../../dev/seed/match-data.js';
import { ApplicationError } from '../../../shared/application-error.js';
import {
  PHASE,
  PLAYERS,
  puuidOf,
  STAFF,
  statsFixture,
  TOURNAMENT,
} from '../testing/stats-fixture.js';
import { weekKey } from './recalculation.js';
import {
  AttachGameDataUseCase,
  FollowUseCase,
  GetHeadToHeadUseCase,
  GetMatchDataStatusUseCase,
  GetMatchStatsUseCase,
  GetPlayerStatsUseCase,
  GetTeamStatsUseCase,
  GetTournamentStatsUseCase,
  ListAchievementsUseCase,
  ListMyFollowsUseCase,
  ProcessStatsJobsUseCase,
  RecalculateTournamentStatsUseCase,
  SaveAchievementUseCase,
  UnfollowUseCase,
} from './stats.use-cases.js';

const code = (promise: Promise<unknown>) =>
  promise.then(
    () => 'ok',
    (error: unknown) => (error instanceof ApplicationError ? error.code : 'unexpected'),
  );

describe('recalculation queue', () => {
  it('derives the lines, aggregates by scope and the meta of a closed match', async () => {
    const f = statsFixture();
    f.playMatch({ id: 'm1', round: 1, winner: 'a', games: ['a', 'b', 'a'] });
    expect(await new ProcessStatsJobsUseCase(f.deps).execute()).toEqual({
      processed: 1,
      failed: 0,
    });

    expect(f.stats.players).toHaveLength(30);
    expect(f.stats.teams).toHaveLength(6);
    const ana = f.stats.aggregates.filter((a) => a.userId === 'a1');
    // Tournament, its season and all-time (no circuit).
    expect(ana.map((a) => a.scopeType).sort()).toEqual(['all_time', 'season', 'tournament']);
    expect(ana[0]?.stats).toMatchObject({ games: 3, wins: 2 });
    expect(f.stats.teamAggregates.filter((t) => t.teamId === 'team-a')).toHaveLength(3);
    const meta = f.stats.meta.get(TOURNAMENT) ?? [];
    expect(meta.reduce((s, m) => s + m.picks, 0)).toBe(30);
    expect(meta.reduce((s, m) => s + m.bans, 0)).toBe(30);
    expect(f.stats.jobs.get('m1')?.processedAt).not.toBeNull();
  });

  it('is idempotent: recalculating writes the same rows and awards nothing twice', async () => {
    const f = statsFixture();
    f.playMatch({ id: 'm1', round: 1, winner: 'a', games: ['a', 'b', 'a'] });
    const process = new ProcessStatsJobsUseCase(f.deps);
    await process.execute();
    const snapshot = JSON.stringify([
      f.stats.players,
      f.stats.aggregates,
      f.stats.champions,
      [...f.stats.meta],
    ]);
    const achievements = f.stats.userAchievements.length;

    f.stats.request('m1');
    await process.execute();
    expect(
      JSON.stringify([f.stats.players, f.stats.aggregates, f.stats.champions, [...f.stats.meta]]),
    ).toBe(snapshot);
    expect(f.stats.userAchievements).toHaveLength(achievements);
    expect(f.stats.mvps.filter((m) => m.scopeType === 'match')).toHaveLength(1);
  });

  it('awards the MVPs of game, series and week; the tournament one only when it is over', async () => {
    const f = statsFixture();
    f.playMatch({ id: 'm1', round: 1, winner: 'a', games: ['a', 'b', 'a'] });
    f.playMatch({ id: 'm2', round: 2, winner: 'b', games: ['b', 'b'], status: 'scheduled' });
    const process = new ProcessStatsJobsUseCase(f.deps);
    await process.execute();

    const scopes = f.stats.mvps.map((m) => m.scopeType);
    expect(scopes.filter((s) => s === 'game')).toHaveLength(3);
    expect(scopes).toContain('match');
    expect(f.stats.mvps.find((m) => m.scopeType === 'week')?.scopeId).toBe(weekKey(PHASE, 1));
    expect(scopes).not.toContain('tournament');
    // The series MVP played for the winner.
    expect(PLAYERS.a).toContain(f.stats.mvps.find((m) => m.scopeType === 'match')?.userId);
    // Game MVPs come from the winning side of each game.
    const game2 = f.stats.mvps.find((m) => m.scopeId === 'm1-g2');
    expect(PLAYERS.b).toContain(game2?.userId);

    // The second match closes the tournament: now there is a tournament MVP.
    f.stats.matches = f.stats.matches.map((m) =>
      m.id === 'm2' ? { ...m, status: 'completed', winnerId: 'entrant-b' } : m,
    );
    f.stats.gamesList = f.stats.gamesList.map((g) =>
      g.matchId === 'm2' ? { ...g, status: 'completed', winnerEntrantId: 'entrant-b' } : g,
    );
    f.stats.request('m2');
    await process.execute();
    expect(f.stats.mvps.filter((m) => m.scopeType === 'tournament')).toHaveLength(1);
  });

  it('awards the active achievements the history earns', async () => {
    const f = statsFixture();
    f.playMatch({ id: 'm1', round: 1, winner: 'a', games: ['a', 'b', 'a'] });
    await new ProcessStatsJobsUseCase(f.deps).execute();
    const of = (userId: string) =>
      f.stats.userAchievements
        .filter((u) => u.userId === userId)
        .map((u) => u.achievementId)
        .sort();
    // Everyone played 3 games and won at least one; the pentakill rule is inactive.
    expect(of('a1')).toEqual(['ach-first-win', 'ach-games-3']);
    expect(of('b1')).toEqual(['ach-first-win', 'ach-games-3']);
  });

  it('a result without match data degrades: no lines, nothing breaks', async () => {
    const f = statsFixture();
    f.playMatch({ id: 'm1', round: 1, winner: 'a', games: ['a', 'a'], withData: false });
    expect(await new ProcessStatsJobsUseCase(f.deps).execute()).toEqual({
      processed: 1,
      failed: 0,
    });
    expect(f.stats.players).toHaveLength(0);
    expect(f.stats.aggregates).toHaveLength(0);

    const profile = await new GetPlayerStatsUseCase(f.deps).execute('user_a1', null);
    expect(profile.overall).toBeNull();
    expect(profile.record).toEqual({ matches: 1, wins: 1, losses: 0 });
    expect(profile.form).toEqual(['win']);
    expect(profile.history[0]).toMatchObject({
      result: 'win',
      scoreFor: 2,
      scoreAgainst: 0,
      games: [],
    });

    const box = await new GetMatchStatsUseCase(f.deps).execute('m1');
    expect(box.games.map((g) => g.hasData)).toEqual([false, false]);
  });

  it('a result overridden without data removes the stats it had', async () => {
    const f = statsFixture();
    f.playMatch({ id: 'm1', round: 1, winner: 'a', games: ['a', 'b', 'a'] });
    const process = new ProcessStatsJobsUseCase(f.deps);
    await process.execute();
    f.stats.gamesList = f.stats.gamesList.map((g) => ({ ...g, payload: null }));
    f.stats.request('m1');
    await process.execute();
    expect(f.stats.players).toHaveLength(0);
    expect(f.stats.aggregates).toHaveLength(0);
    expect(
      f.stats.mvps.filter((m) => m.scopeType === 'game' || m.scopeType === 'match'),
    ).toHaveLength(0);
  });

  it('a failing job is retried with backoff', async () => {
    const f = statsFixture();
    f.playMatch({ id: 'm1', round: 1, winner: 'a', games: ['a', 'a'] });
    f.stats.saveMatchStats = () => Promise.reject(new Error('database down'));
    expect(await new ProcessStatsJobsUseCase(f.deps).execute()).toEqual({
      processed: 0,
      failed: 1,
    });
    expect(f.stats.jobs.get('m1')).toMatchObject({ attempts: 1, dead: false });
    expect(f.stats.jobs.get('m1')?.next?.toISOString()).toBe('2026-10-24T22:00:30.000Z');
  });

  it('staff can request the whole tournament again', async () => {
    const f = statsFixture();
    f.playMatch({ id: 'm1', round: 1, winner: 'a', games: ['a', 'a'] });
    const recalc = new RecalculateTournamentStatsUseCase(f.deps);
    expect(await code(recalc.execute('a1', TOURNAMENT))).toBe('staff_only');
    expect(await recalc.execute(STAFF, TOURNAMENT)).toEqual({ matches: 1 });
  });
});

describe('match data uploaded by staff', () => {
  const setup = () => {
    const f = statsFixture();
    f.playMatch({ id: 'm1', round: 1, winner: 'a', games: ['a', 'a'], withData: false });
    return f;
  };
  // Game 1: the game row says blue = Aurora, which won.
  const data = (blue: readonly string[], red: readonly string[], blueWins: boolean) => ({
    data: demoMatchData({
      key: 'upload',
      blue: blue.map(puuidOf),
      red: red.map(puuidOf),
      blueWins,
      endedAt: new Date('2026-10-11T20:00:00Z'),
    }),
  });

  it('maps the PUUIDs to the players, stores the draft and requests a recalculation', async () => {
    const f = setup();
    f.stats.jobs.clear();
    await new AttachGameDataUseCase(f.deps).execute(
      STAFF,
      'm1-g1',
      data(PLAYERS.a, PLAYERS.b, true),
    );
    const [write] = f.stats.attached;
    expect(write?.data).toMatchObject({ blueEntrantId: 'entrant-a', redEntrantId: 'entrant-b' });
    expect(write?.data.participants.filter((p) => p.isExpected)).toHaveLength(10);
    expect(write?.data.participants[0]).toMatchObject({ userId: 'a1', riotAccountId: 'riot-a1' });
    const draft = write?.data.draft ?? [];
    expect(draft.slice(0, 10).every((d) => d.action === 'ban')).toBe(true);
    expect(draft.map((d) => d.sequence)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(f.stats.jobs.has('m1')).toBe(true);
  });

  it('shows staff which games have data', async () => {
    const f = setup();
    await new AttachGameDataUseCase(f.deps).execute(
      STAFF,
      'm1-g1',
      data(PLAYERS.a, PLAYERS.b, true),
    );
    const status = await new GetMatchDataStatusUseCase(f.deps).execute(STAFF, 'm1');
    expect(status.games.map((g) => [g.number, g.hasData])).toEqual([
      [1, true],
      [2, false],
    ]);
    expect(await code(new GetMatchDataStatusUseCase(f.deps).execute('a1', 'm1'))).toBe(
      'staff_only',
    );
  });

  it('takes the real sides from the rosters (Riot may swap them)', async () => {
    const f = setup();
    // Boreal on blue, Aurora on red, Aurora wins.
    await new AttachGameDataUseCase(f.deps).execute(
      STAFF,
      'm1-g1',
      data(PLAYERS.b, PLAYERS.a, false),
    );
    expect(f.stats.attached[0]?.data).toMatchObject({
      blueEntrantId: 'entrant-b',
      redEntrantId: 'entrant-a',
    });
  });

  it('refuses data whose winner is not the recorded one, and non-staff', async () => {
    const f = setup();
    const attach = new AttachGameDataUseCase(f.deps);
    expect(await code(attach.execute(STAFF, 'm1-g1', data(PLAYERS.a, PLAYERS.b, false)))).toBe(
      'match_data_winner_mismatch',
    );
    expect(await code(attach.execute('a1', 'm1-g1', data(PLAYERS.a, PLAYERS.b, true)))).toBe(
      'staff_only',
    );
    expect(await code(attach.execute(STAFF, 'nope', data(PLAYERS.a, PLAYERS.b, true)))).toBe(
      'game_not_found',
    );
    expect(await code(attach.execute(STAFF, 'm1-g1', { data: { info: {} } } as never))).toBe(
      'match_data_invalid',
    );
  });
});

describe('public stats', () => {
  const played = async () => {
    const f = statsFixture();
    f.playMatch({ id: 'm1', round: 1, winner: 'a', games: ['a', 'b', 'a'] });
    await new ProcessStatsJobsUseCase(f.deps).execute();
    return f;
  };

  it('the player profile has radar, champions, evolution, achievements and history', async () => {
    const f = await played();
    const p = await new GetPlayerStatsUseCase(f.deps).execute('user_a3', null);
    expect(p.overall?.games).toBe(3);
    expect(Object.keys(p.overall?.radar ?? {})).toHaveLength(5);
    expect(p.champions[0]?.champion.name).not.toMatch(/^Campeón/);
    expect(p.evolution).toHaveLength(1);
    expect(p.tournaments[0]?.tournament.slug).toBe('liga');
    expect(p.achievements.map((a) => a.key)).toContain('first_win');
    expect(p.history[0]).toMatchObject({
      entrantName: 'Aurora',
      opponentName: 'Boreal',
      result: 'win',
    });
    expect(p.history[0]?.games).toHaveLength(3);
  });

  it('a player who hides their teams does not show the team name in the history', async () => {
    const f = await played();
    f.privacy.set('a3', { ...(f.privacy.get('a3') ?? ({} as never)), teams: 'private' });
    const p = await new GetPlayerStatsUseCase(f.deps).execute('user_a3', null);
    expect(p.history[0]?.entrantName).toBeNull();
    const team = await new GetTeamStatsUseCase(f.deps).execute('equipo-a', null);
    expect(team.roster.map((r) => r.player.username)).not.toContain('user_a3');
    expect(team.roster).toHaveLength(4);
  });

  it('the team page has its record, form and numbers', async () => {
    const f = await played();
    const team = await new GetTeamStatsUseCase(f.deps).execute('equipo-b', null);
    expect(team.record).toEqual({ matches: 1, wins: 0, losses: 1 });
    expect(team.form).toEqual(['loss']);
    expect(team.overall).toMatchObject({ games: 3, wins: 1 });
    expect(team.roster[0]?.stats?.games).toBe(3);
  });

  it('the tournament page has leaders, champion meta and the MVP of the week', async () => {
    const f = await played();
    const t = await new GetTournamentStatsUseCase(f.deps).execute('liga', null);
    expect(t).toMatchObject({ gamesWithData: 3, gamesPlayed: 3 });
    expect(t.leaders.map((l) => l.stat)).toEqual([
      'kda',
      'damagePerMin',
      'csPerMin',
      'visionPerMin',
      'kills',
    ]);
    expect(t.leaders[0]?.entries).toHaveLength(5);
    const values = t.leaders[0]?.entries.map((e) => e.value) ?? [];
    expect([...values].sort((a, b) => b - a)).toEqual(values);
    expect(t.champions.every((c) => c.presence > 0 && c.presence <= 1)).toBe(true);
    expect(t.weeklyMvps).toHaveLength(1);
    expect(t.weeklyMvps[0]).toMatchObject({ phaseName: 'Fase regular', round: 1 });
    // Its only match is closed: the tournament has its MVP.
    expect(t.mvp?.games).toBe(3);
  });

  it('head-to-head compares two players over the games they faced each other', async () => {
    const f = await played();
    const h2h = await new GetHeadToHeadUseCase(f.deps).execute('user_a3', 'user_b3');
    expect(h2h).toMatchObject({ games: 3, winsA: 2, winsB: 1 });
    expect(h2h.statsA?.games).toBe(3);
    const teammates = await new GetHeadToHeadUseCase(f.deps).execute('user_a3', 'user_a4');
    expect(teammates.games).toBe(0);
    expect(await code(new GetHeadToHeadUseCase(f.deps).execute('user_a3', 'user_a3'))).toBe(
      'same_player',
    );
  });

  it('the box score of each game shows players and bans', async () => {
    const f = await played();
    const box = await new GetMatchStatsUseCase(f.deps).execute('m1');
    expect(box.games).toHaveLength(3);
    expect(box.games[0]?.teams.map((t) => t.players.length)).toEqual([5, 5]);
    expect(box.games[0]?.teams[0]?.bans).toHaveLength(5);
    expect(box.games[0]?.teams.flatMap((t) => t.players).filter((p) => p.isMvp)).toHaveLength(1);
  });
});

describe('follows', () => {
  it('follows and unfollows, idempotently, and counts without revealing who', async () => {
    const f = statsFixture();
    const follow = new FollowUseCase(f.deps);
    expect(await follow.execute('fan', { type: 'team', key: 'equipo-a' })).toEqual({
      followers: 1,
      following: true,
    });
    expect(await follow.execute('fan', { type: 'team', key: 'equipo-a' })).toEqual({
      followers: 1,
      following: true,
    });
    const team = await new GetTeamStatsUseCase(f.deps).execute('equipo-a', 'a1');
    expect(team.follow).toEqual({ followers: 1, following: false });
    expect(
      await new UnfollowUseCase(f.deps).execute('fan', { type: 'team', key: 'equipo-a' }),
    ).toEqual({ followers: 0, following: false });
  });

  it('lists only the user’s own follows, with where to go', async () => {
    const f = statsFixture();
    const follow = new FollowUseCase(f.deps);
    await follow.execute('fan', { type: 'user', key: 'user_a1' });
    await follow.execute('fan', { type: 'tournament', key: 'liga' });
    await follow.execute('b1', { type: 'team', key: 'equipo-a' });
    const list = await new ListMyFollowsUseCase(f.deps).execute('fan');
    expect(list.items.map((i) => i.href).sort()).toEqual(['/jugadores/user_a1', '/torneos/liga']);
  });

  it('refuses to follow oneself, unknown targets and private tournaments', async () => {
    const f = statsFixture();
    const follow = new FollowUseCase(f.deps);
    expect(await code(follow.execute('a1', { type: 'user', key: 'user_a1' }))).toBe(
      'cannot_follow_self',
    );
    expect(await code(follow.execute('a1', { type: 'team', key: 'nadie' }))).toBe('team_not_found');
    const t = f.stats.tournamentList.get(TOURNAMENT);
    if (t) f.stats.tournamentList.set(TOURNAMENT, { ...t, isPublic: false });
    expect(await code(follow.execute('a1', { type: 'tournament', key: 'liga' }))).toBe(
      'tournament_not_found',
    );
  });
});

describe('achievement rules', () => {
  it('staff lists the rules and overrides a platform one for the organization', async () => {
    const f = statsFixture();
    const list = new ListAchievementsUseCase(f.deps);
    expect(await code(list.execute('a1'))).toBe('staff_only');
    await new SaveAchievementUseCase(f.deps).execute(STAFF, 'games_3', {
      name: 'Cinco games',
      description: 'Juega 5 games.',
      icon: 'shield',
      criteria: { type: 'games', gte: 5 },
      active: true,
    });
    const items = (await list.execute(STAFF)).items;
    expect(items.find((a) => a.key === 'games_3')).toMatchObject({
      name: 'Cinco games',
      scope: 'organization',
      criteria: { type: 'games', gte: 5 },
    });
    expect(items).toHaveLength(3);

    // The override applies from the next recalculation.
    f.playMatch({ id: 'm1', round: 1, winner: 'a', games: ['a', 'b', 'a'] });
    await new ProcessStatsJobsUseCase(f.deps).execute();
    expect(
      f.stats.userAchievements.filter((u) => u.achievementId.includes('games_3')),
    ).toHaveLength(0);
  });
});
