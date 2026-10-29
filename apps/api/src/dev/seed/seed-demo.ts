// pnpm seed:demo — builds the demo scenario through the real use cases.
// Idempotent: whatever already exists (by demo email, team or tournament
// name) is reused or skipped, so running it twice duplicates nothing.
import {
  AttachMatchDataRequestSchema,
  CreateTeamRequestSchema,
  CreateTournamentRequestSchema,
  DecideRegistrationRequestSchema,
  RegisterRequestSchema,
  ReportResultRequestSchema,
  RulebookDraftRequestSchema,
  SeedingRequestSchema,
  StartRiotVerificationRequestSchema,
  TournamentActionRequestSchema,
  UpdateFreeAgentRequestSchema,
  UpdateProfileRequestSchema,
} from '@league/contracts';

import {
  GetMyProfileUseCase,
  UpdateProfileUseCase,
} from '../../modules/identity/application/profile.use-cases.js';
import {
  CheckInUseCase,
  GenerateFixturesUseCase,
  ReportResultUseCase,
  RunMatchActionUseCase,
} from '../../modules/matches/application/matches.use-cases.js';
import {
  DecideRegistrationUseCase,
  GetRegistrationContextUseCase,
  RegisterUseCase,
  SeedRegistrationsUseCase,
} from '../../modules/registrations/application/registrations.use-cases.js';
import {
  ConfirmRiotVerificationUseCase,
  GetMyRiotAccountUseCase,
  StartRiotVerificationUseCase,
} from '../../modules/riot-accounts/application/riot-verification.use-cases.js';
import { AutoScheduleUseCase } from '../../modules/scheduling/application/scheduling.use-cases.js';
import {
  AttachGameDataUseCase,
  ProcessStatsJobsUseCase,
} from '../../modules/stats/application/stats.use-cases.js';
import {
  AcceptInvitationUseCase,
  CreateTeamUseCase,
  GetTeamUseCase,
  InviteToTeamUseCase,
  ListMyTeamsUseCase,
  UpdateFreeAgentUseCase,
  UploadTeamLogoUseCase,
} from '../../modules/teams/application/teams.use-cases.js';
import {
  CreateTournamentUseCase,
  RunTournamentActionUseCase,
  SaveRulebookDraftUseCase,
} from '../../modules/tournaments/application/tournaments.use-cases.js';
import { listAuthUsers, type SeedContext } from './context.js';
import {
  captainOf,
  DEMO_CIRCUIT,
  DEMO_PLAYERS,
  DEMO_RULEBOOK,
  DEMO_SEASON,
  DEMO_STAFF_EMAIL,
  DEMO_TEAMS,
  DEMO_TOURNAMENTS,
  LEAGUE_ROUNDS_PLAYED,
  LEAGUE_STARTED_DAYS_AGO,
  leagueGames,
  membersOf,
  type DemoPlayer,
  type DemoTournament,
} from './demo-data.js';
import { demoMatchData } from './match-data.js';
import { placeholderLogo } from './png.js';

export interface SeedSummary {
  players: number;
  teams: number;
  tournaments: { name: string; slug: string; status: string; created: boolean }[];
  captains: { team: string; email: string }[];
}

type Log = (line: string) => void;

const DAY = 86_400_000;

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

async function ensureAuthUser(
  ctx: SeedContext,
  existing: Map<string, string>,
  email: string,
  password: string,
): Promise<string> {
  const found = existing.get(email);
  if (found) return found;
  const { data, error } = await ctx.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`createUser failed for a demo account: ${error.message}`);
  existing.set(email, data.user.id);
  return data.user.id;
}

async function ensureStaff(ctx: SeedContext, existing: Map<string, string>, password: string) {
  const id = await ensureAuthUser(ctx, existing, DEMO_STAFF_EMAIL, password);
  // No use case assigns platform roles yet (docs/12): the same update the E2E staff uses.
  const { error } = await ctx.db
    .from('users')
    .update({ platform_role: 'super_admin', display_name: 'Staff demo' })
    .eq('id', id);
  if (error) throw new Error(`staff role failed: ${error.message}`);
  return id;
}

async function ensurePlayer(ctx: SeedContext, id: string, p: DemoPlayer): Promise<void> {
  const profile = await ctx.use(GetMyProfileUseCase).execute(id);
  if (profile.username === null) {
    await ctx.use(UpdateProfileUseCase).execute(
      id,
      UpdateProfileRequestSchema.parse({
        displayName: p.displayName,
        username: p.username,
        countryCode: p.countryCode,
        gameRegion: 'la1',
        birthDate: p.birthDate,
        primaryRole: p.primaryRole,
        secondaryRole: p.secondaryRole,
        bio: p.bio ?? '',
      }),
    );
  }
  const riot = await ctx.use(GetMyRiotAccountUseCase).execute(id);
  if (!riot.account) {
    // The stub "sees" the icon change on the second lookup, as a player would do it.
    const attempt = await ctx.use(StartRiotVerificationUseCase).execute(
      id,
      StartRiotVerificationRequestSchema.parse({
        gameName: p.riot.gameName,
        tagLine: p.riot.tagLine,
        region: 'la1',
      }),
    );
    await ctx.use(ConfirmRiotVerificationUseCase).execute(id, attempt.id);
  }
  if (p.team === null) {
    await ctx.use(UpdateFreeAgentUseCase).execute(
      id,
      UpdateFreeAgentRequestSchema.parse({
        active: true,
        roles: [p.primaryRole, ...(p.secondaryRole ? [p.secondaryRole] : [])],
        message: `Busco equipo para competir. Juego ${p.primaryRole}.`,
        availability: { version: 1, days: [5, 6, 0], from: '18:00', to: '23:00' },
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// Season, circuit and teams
// ---------------------------------------------------------------------------

/** Seasons and circuits have no use case yet (managed in a later module, docs/03 §5). */
async function ensureSeasonAndCircuit(ctx: SeedContext) {
  const season = await ctx.db
    .from('seasons')
    .select('id')
    .eq('organization_id', ctx.organizationId)
    .eq('name', DEMO_SEASON.name)
    .maybeSingle();
  let seasonId = season.data?.id;
  if (!seasonId) {
    const now = Date.now();
    const { data, error } = await ctx.db
      .from('seasons')
      .insert({
        organization_id: ctx.organizationId,
        name: DEMO_SEASON.name,
        starts_at: new Date(now - 60 * DAY).toISOString(),
        ends_at: new Date(now + 120 * DAY).toISOString(),
        status: 'active',
      })
      .select('id')
      .single();
    if (error) throw new Error(`season failed: ${error.message}`);
    seasonId = data.id;
  }
  const circuit = await ctx.db
    .from('circuits')
    .select('id')
    .eq('organization_id', ctx.organizationId)
    .eq('name', DEMO_CIRCUIT.name)
    .maybeSingle();
  let circuitId = circuit.data?.id;
  if (!circuitId) {
    const { data, error } = await ctx.db
      .from('circuits')
      .insert({
        organization_id: ctx.organizationId,
        season_id: seasonId,
        name: DEMO_CIRCUIT.name,
        description: 'Circuito de demostración de torneos relámpago.',
        status: 'active',
      })
      .select('id')
      .single();
    if (error) throw new Error(`circuit failed: ${error.message}`);
    circuitId = data.id;
  }
  return { seasonId, circuitId };
}

async function ensureTeam(ctx: SeedContext, ids: Map<string, string>, index: number) {
  const team = DEMO_TEAMS[index];
  if (!team) throw new Error(`no demo team ${String(index)}`);
  const captainId = userId(ids, captainOf(index));
  const mine = await ctx.use(ListMyTeamsUseCase).execute(captainId);
  let current = mine.find((t) => t.name === team.name);
  if (!current) {
    const created = await ctx.use(CreateTeamUseCase).execute(
      captainId,
      CreateTeamRequestSchema.parse({
        name: team.name,
        tag: team.tag,
        region: 'la1',
        description: team.description,
      }),
    );
    const logo = placeholderLogo(team.colors);
    await ctx
      .use(UploadTeamLogoUseCase)
      .execute(captainId, created.id, { buffer: logo, size: logo.length });
    current = { ...created, myRole: 'captain' };
  }
  const detail = await ctx.use(GetTeamUseCase).execute(captainId, current.slug);
  const members = new Set(detail.members.map((m) => m.userId));
  const roster = membersOf(index);
  for (const [slot, p] of roster.entries()) {
    const id = userId(ids, p);
    if (members.has(id)) continue;
    const invitation = await ctx.use(InviteToTeamUseCase).execute(captainId, current.id, {
      kind: 'user',
      userId: id,
      teamRole: slot === roster.length - 1 ? 'substitute' : 'player',
    });
    await ctx.use(AcceptInvitationUseCase).execute(id, { invitationId: invitation.id });
  }
  return current.id;
}

function userId(ids: Map<string, string>, p: DemoPlayer): string {
  const id = ids.get(p.email);
  if (!id) throw new Error(`demo player ${p.key} has no account`);
  return id;
}

// ---------------------------------------------------------------------------
// Tournaments
// ---------------------------------------------------------------------------

interface MatchRow {
  id: string;
  round: number;
  entrant_a_id: string | null;
  entrant_b_id: string | null;
  scheduled_at: string | null;
  status: string;
}

async function matchesOf(ctx: SeedContext, tournamentId: string): Promise<MatchRow[]> {
  const { data, error } = await ctx.db
    .from('matches')
    .select('id, round, entrant_a_id, entrant_b_id, scheduled_at, status')
    .eq('tournament_id', tournamentId)
    .order('round')
    .order('position');
  if (error) throw new Error(`matches read failed: ${error.message}`);
  return data;
}

interface Story {
  staff: string;
  ids: Map<string, string>;
  teamIds: string[];
  links: { seasonId: string; circuitId: string };
}

async function createTournament(ctx: SeedContext, story: Story, t: DemoTournament) {
  const now = ctx.clock.now();
  const created = await ctx
    .use(CreateTournamentUseCase)
    .execute(
      story.staff,
      CreateTournamentRequestSchema.parse({ config: t.config(now, story.links) }),
    );
  await ctx
    .use(SaveRulebookDraftUseCase)
    .execute(story.staff, created.id, RulebookDraftRequestSchema.parse(DEMO_RULEBOOK));
  const action = ctx.use(RunTournamentActionUseCase);
  const noReason = TournamentActionRequestSchema.parse({});
  await action.execute(story.staff, created.id, 'publish', noReason);
  await action.execute(story.staff, created.id, 'open_registration', noReason);

  const entrantOfTeam = new Map<number, string>();
  for (const team of t.teams) {
    const captain = userId(story.ids, captainOf(team));
    const context = await ctx.use(GetRegistrationContextUseCase).execute(captain, created.slug);
    const roster = membersOf(team).map((p, slot, all) => ({
      userId: userId(story.ids, p),
      role: slot === all.length - 1 ? 'substitute' : 'starter',
      gameRole: slot === all.length - 1 ? null : p.primaryRole,
    }));
    const registration = await ctx.use(RegisterUseCase).execute(
      captain,
      created.id,
      RegisterRequestSchema.parse({
        teamId: story.teamIds[team],
        roster,
        rulebookVersionId: context.tournament.rulebook?.id ?? null,
        acceptRules: true,
      }),
    );
    entrantOfTeam.set(team, registration.id);
    if (t.approved.includes(team)) {
      await ctx
        .use(DecideRegistrationUseCase)
        .execute(
          story.staff,
          registration.id,
          DecideRegistrationRequestSchema.parse({ decision: 'approve' }),
        );
    }
  }
  return { id: created.id, slug: created.slug, entrantOfTeam };
}

async function startCompetition(ctx: SeedContext, story: Story, tournamentId: string) {
  await ctx
    .use(RunTournamentActionUseCase)
    .execute(
      story.staff,
      tournamentId,
      'close_registration',
      TournamentActionRequestSchema.parse({}),
    );
  await ctx
    .use(SeedRegistrationsUseCase)
    .execute(story.staff, tournamentId, SeedingRequestSchema.parse({ method: 'random' }));
  await ctx.use(GenerateFixturesUseCase).execute(story.staff, tournamentId);
  await ctx.use(AutoScheduleUseCase).execute(story.staff, tournamentId);
}

/** Check-in of both captains and the same report from each: the match confirms itself. */
async function playMatch(
  ctx: SeedContext,
  story: Story,
  match: MatchRow,
  teamOfEntrant: Map<string, number>,
  round: number,
) {
  const teamA = teamOfEntrant.get(match.entrant_a_id ?? '');
  const teamB = teamOfEntrant.get(match.entrant_b_id ?? '');
  if (teamA === undefined || teamB === undefined) throw new Error('league match without teams');
  if (match.scheduled_at) ctx.clock.set(new Date(Date.parse(match.scheduled_at) - 20 * 60_000));
  await ctx.use(RunMatchActionUseCase).execute(story.staff, match.id, 'open_checkin');
  const captains = [captainOf(teamA), captainOf(teamB)].map((p) => userId(story.ids, p));
  for (const captain of captains) await ctx.use(CheckInUseCase).execute(captain, match.id);
  if (match.scheduled_at) ctx.clock.set(new Date(Date.parse(match.scheduled_at) + 70 * 60_000));
  const report = ReportResultRequestSchema.parse({ games: leagueGames(teamA, teamB, round) });
  for (const captain of captains)
    await ctx.use(ReportResultUseCase).execute(captain, match.id, report);
}

async function seedTournament(ctx: SeedContext, story: Story, t: DemoTournament, log: Log) {
  const league = t.key === 'league';
  // The league "started" weeks ago: its past rounds are played at their dates.
  ctx.clock.set(league ? new Date(Date.now() - LEAGUE_STARTED_DAYS_AGO * DAY) : null);
  try {
    const created = await createTournament(ctx, story, t);
    if (t.key === 'open') return created.slug;
    await startCompetition(ctx, story, created.id);
    if (league) {
      const teamOfEntrant = new Map([...created.entrantOfTeam].map(([team, id]) => [id, team]));
      const matches = await matchesOf(ctx, created.id);
      for (let round = 1; round <= LEAGUE_ROUNDS_PLAYED; round += 1) {
        for (const match of matches.filter((m) => m.round === round))
          await playMatch(ctx, story, match, teamOfEntrant, round);
        log(`  jornada ${String(round)} jugada`);
      }
    }
    return created.slug;
  } finally {
    ctx.clock.set(null);
  }
}

// ---------------------------------------------------------------------------
// Match data (m09): what Riot would send for each played game
// ---------------------------------------------------------------------------

const ROLE_ORDER = ['top', 'jungle', 'mid', 'adc', 'support'];

/**
 * Attaches a fictional Match-V5 payload to every completed game of the
 * tournament that has none yet (staff upload, the manual path until m08).
 */
async function attachMatchData(ctx: SeedContext, staff: string, tournamentId: string) {
  const { data: matches, error } = await ctx.db
    .from('matches')
    .select('id, round, position')
    .eq('tournament_id', tournamentId)
    .eq('status', 'completed');
  if (error) throw new Error(`matches read failed: ${error.message}`);
  const { data: games, error: gamesError } = await ctx.db
    .from('games')
    .select(
      'id, match_id, game_number, blue_entrant_id, red_entrant_id, winner_entrant_id, ended_at',
    )
    .in(
      'match_id',
      matches.map((m) => m.id),
    )
    .eq('status', 'completed')
    .is('raw_match_payload', null);
  if (gamesError) throw new Error(`games read failed: ${gamesError.message}`);
  if (games.length === 0) return 0;

  const entrantIds = [...new Set(games.flatMap((g) => [g.blue_entrant_id, g.red_entrant_id]))];
  const { data: roster, error: rosterError } = await ctx.db
    .from('entrant_roster_members')
    .select('entrant_id, user_id, game_role, created_at')
    .in('entrant_id', entrantIds)
    .eq('roster_role', 'starter')
    .is('removed_at', null)
    .order('created_at');
  if (rosterError) throw new Error(`roster read failed: ${rosterError.message}`);
  const { data: accounts, error: accountsError } = await ctx.db
    .from('riot_accounts')
    .select('user_id, puuid, game_name, tag_line')
    .in(
      'user_id',
      roster.map((r) => r.user_id),
    )
    .is('unlinked_at', null);
  if (accountsError) throw new Error(`riot accounts read failed: ${accountsError.message}`);
  const account = new Map(accounts.map((a) => [a.user_id, a]));
  const riotIds = new Map(
    accounts.map((a) => [a.puuid, { gameName: a.game_name, tagLine: a.tag_line }]),
  );
  const puuidsOf = (entrantId: string) =>
    roster
      .filter((r) => r.entrant_id === entrantId)
      .sort((a, b) => ROLE_ORDER.indexOf(a.game_role ?? '') - ROLE_ORDER.indexOf(b.game_role ?? ''))
      .flatMap((r) => {
        const puuid = account.get(r.user_id)?.puuid;
        return puuid ? [puuid] : [];
      });
  const matchOf = new Map(matches.map((m) => [m.id, m]));

  for (const game of games) {
    const blue = puuidsOf(game.blue_entrant_id);
    const red = puuidsOf(game.red_entrant_id);
    const blueWins = game.winner_entrant_id === game.blue_entrant_id;
    const match = matchOf.get(game.match_id);
    // One memorable game: the winners' mid laner closes it with a pentakill.
    const penta = match?.round === 2 && match.position === 1 && game.game_number === 1;
    const data = demoMatchData({
      key: game.id,
      blue,
      red,
      blueWins,
      endedAt: new Date(game.ended_at ?? Date.now()),
      riotIds,
      ...(penta ? { pentakill: (blueWins ? blue : red)[2] } : {}),
    });
    await ctx
      .use(AttachGameDataUseCase)
      .execute(staff, game.id, AttachMatchDataRequestSchema.parse({ data }));
  }
  return games.length;
}

/** Runs the stats queue until it is empty (the API worker is off in the seed). */
async function drainStats(ctx: SeedContext) {
  let matches = 0;
  for (let pass = 0; pass < 100; pass += 1) {
    const { processed, failed } = await ctx.use(ProcessStatsJobsUseCase).execute();
    if (failed > 0) throw new Error(`${String(failed)} stats jobs failed`);
    if (processed === 0) return matches;
    matches += processed;
  }
  return matches;
}

async function existingTournament(ctx: SeedContext, name: string) {
  const { data, error } = await ctx.db
    .from('tournaments')
    .select('slug, status')
    .eq('organization_id', ctx.organizationId)
    .eq('name', name)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(`tournament read failed: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------

export async function seedDemo(ctx: SeedContext, password: string, log: Log): Promise<SeedSummary> {
  const ids = new Map(
    (await listAuthUsers(ctx.auth)).flatMap((u) => (u.email ? [[u.email, u.id] as const] : [])),
  );
  log('Cuentas…');
  const staff = await ensureStaff(ctx, ids, password);
  for (const p of DEMO_PLAYERS) {
    const id = await ensureAuthUser(ctx, ids, p.email, password);
    await ensurePlayer(ctx, id, p);
  }
  log(`  ${String(DEMO_PLAYERS.length)} jugadores con perfil y cuenta de Riot verificada`);

  log('Temporada, circuito y equipos…');
  const links = await ensureSeasonAndCircuit(ctx);
  const teamIds: string[] = [];
  for (const [index] of DEMO_TEAMS.entries()) teamIds.push(await ensureTeam(ctx, ids, index));
  log(`  ${String(teamIds.length)} equipos con 5 titulares y 1 suplente`);

  const story: Story = { staff, ids, teamIds, links };
  const tournaments: SeedSummary['tournaments'] = [];
  for (const t of DEMO_TOURNAMENTS) {
    const found = await existingTournament(ctx, t.name);
    if (found) {
      log(`Torneo ${t.name}: ya existe, se deja como está`);
      tournaments.push({ name: t.name, slug: found.slug, status: found.status, created: false });
      continue;
    }
    log(`Torneo ${t.name}…`);
    const slug = await seedTournament(ctx, story, t, log);
    const after = await existingTournament(ctx, t.name);
    tournaments.push({ name: t.name, slug, status: after?.status ?? 'unknown', created: true });
  }

  const league = DEMO_TOURNAMENTS.find((t) => t.key === 'league');
  const leagueRow = league
    ? await ctx.db
        .from('tournaments')
        .select('id')
        .eq('organization_id', ctx.organizationId)
        .eq('name', league.name)
        .is('deleted_at', null)
        .maybeSingle()
    : null;
  if (leagueRow?.data) {
    log('Datos de partida y estadísticas de la liga…');
    const attached = await attachMatchData(ctx, staff, leagueRow.data.id);
    const recalculated = await drainStats(ctx);
    log(`  ${String(attached)} games con datos; ${String(recalculated)} partidas recalculadas`);
  }

  return {
    players: DEMO_PLAYERS.length,
    teams: DEMO_TEAMS.length,
    tournaments,
    captains: DEMO_TEAMS.map((team, i) => ({ team: team.name, email: captainOf(i).email })),
  };
}
