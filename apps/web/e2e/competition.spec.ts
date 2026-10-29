import { expect, type Page, test } from '@playwright/test';

import {
  api,
  createAccount,
  deleteAccounts,
  deleteTournaments,
  hasDatabase,
  puuidOf,
  runId,
  staffAccount,
  type TestAccount,
} from './support/accounts';
import { demoMatchData } from '../../api/src/dev/seed/match-data';
import { signIn } from './support/sign-in';

// docs/specs/m05: a flash tournament of four teams played to the champion.
// Setup (tournament, registrations) goes through the API; the competition
// itself is driven in the browser: seeding, fixtures, a check-in forfeit, a
// dispute resolved by staff, and the champion appearing live on the public page.
test.describe.configure({ mode: 'serial' });
test.skip(!hasDatabase, 'Needs SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY');

interface Captain extends TestAccount {
  team: string;
  teamId: string;
  teamSlug: string;
  username: string;
}

const accounts: TestAccount[] = [];
const captains: Captain[] = [];
let staff: TestAccount;
let tournamentId = '';
const slug = `e2e-copa-${runId}`;
const teamName = (i: number) => `Copa${String(i)} ${runId}`;

interface MatchView {
  id: string;
  round: number;
  status: string;
  entrantA: { displayName: string } | null;
  entrantB: { displayName: string } | null;
}

async function board(): Promise<MatchView[]> {
  const data = (await api(staff, 'GET', `/admin/tournaments/${tournamentId}/board`)) as {
    phases: { matches: MatchView[] }[];
  };
  return data.phases.flatMap((p) => p.matches);
}

const captainOf = (name: string | undefined) => {
  const found = captains.find((c) => c.team === name);
  if (!found) throw new Error(`no captain for ${String(name)}`);
  return found;
};

test.beforeAll(async () => {
  // Several accounts, Riot links and teams: longer than a test.
  test.setTimeout(180_000);
  staff = await staffAccount();
  for (let i = 1; i <= 4; i += 1) {
    const account = await createAccount(`c${String(i)}`);
    accounts.push(account);
    await api(account, 'PUT', '/me/profile', {
      displayName: `Capi ${String(i)}`,
      username: `capi${String(i)}_${runId}`,
      countryCode: 'MX',
      gameRegion: 'la1',
      birthDate: '2002-02-02',
      primaryRole: 'mid',
      secondaryRole: null,
      bio: '',
    });
    const attempt = (await api(account, 'POST', '/me/riot-account/verifications', {
      gameName: `Capi${String(i)} ${runId}`,
      tagLine: 'E2E',
      region: 'la1',
    })) as { id: string };
    await api(account, 'POST', `/me/riot-account/verifications/${attempt.id}/confirm`);
    const team = (await api(account, 'POST', '/teams', {
      name: teamName(i),
      tag: `C${String(i)}${runId.slice(-2).toUpperCase()}`.replace(/[^A-Z0-9]/g, 'X'),
      region: 'la1',
      description: '',
    })) as { id: string; slug: string };
    captains.push({
      ...account,
      team: teamName(i),
      teamId: team.id,
      teamSlug: team.slug,
      username: `capi${String(i)}_${runId}`,
    });
  }

  const contracts = await import('@league/contracts');
  const base = contracts.DEFAULT_TOURNAMENT_CONFIG;
  const created = (await api(staff, 'POST', '/admin/tournaments', {
    config: {
      ...base,
      basics: { ...base.basics, name: `E2E Copa ${runId}` },
      capacity: { capacity: 4, waitlistEnabled: true },
      game: { ...base.game, teamSize: 1 },
      roster: { ...base.roster, starters: 1, maxSubstitutes: 0, coachAllowed: false },
      format: {
        seedingMethod: 'random',
        phases: [
          {
            ...contracts.defaultPhase('single_elimination', 'Eliminación'),
            seriesFormat: 'bo1',
            finalSeriesFormat: 'bo1',
          },
        ],
      },
      schedule: {
        ...base.schedule,
        registrationOpensAt: new Date(Date.now() - 86_400_000).toISOString(),
        registrationClosesAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        startsAt: new Date(Date.now() + 8 * 86_400_000).toISOString(),
      },
    },
  })) as { id: string };
  tournamentId = created.id;
  await api(staff, 'PUT', `/admin/tournaments/${tournamentId}/rulebook`, {
    title: 'Reglamento',
    content: 'Reglas de la copa.',
    changeSummary: null,
  });
  await api(staff, 'POST', `/admin/tournaments/${tournamentId}/actions/publish`, {});
  await api(staff, 'POST', `/admin/tournaments/${tournamentId}/actions/open_registration`, {});
  const context = (await api(
    captains[0] as Captain,
    'GET',
    `/tournaments/by-slug/${slug}/registration`,
  )) as {
    tournament: { rulebook: { id: string } };
  };
  for (const captain of captains) {
    const registration = (await api(captain, 'POST', `/tournaments/${tournamentId}/registrations`, {
      teamId: captain.teamId,
      roster: [{ userId: captain.id, role: 'starter' }],
      rulebookVersionId: context.tournament.rulebook.id,
      acceptRules: true,
    })) as { id: string };
    await api(staff, 'POST', `/admin/registrations/${registration.id}/decision`, {
      decision: 'approve',
    });
  }
  await api(staff, 'POST', `/admin/tournaments/${tournamentId}/actions/close_registration`, {});
});

test.afterAll(async () => {
  await deleteTournaments(slug);
  await deleteAccounts(accounts);
});

async function confirm(page: Page, button: string) {
  await page.getByRole('alertdialog').getByRole('button', { name: button }).click();
}

test('staff seeds the entrants and generates the bracket', async ({ page }) => {
  await signIn(page, staff, `/admin/torneos/${tournamentId}?tab=participants`);
  await page.getByRole('button', { name: 'Aplicar siembra' }).click();
  await expect(page.getByText('Siembra aplicada.')).toBeVisible();

  await page.getByRole('tab', { name: 'Fases y bracket' }).click();
  await page.getByRole('button', { name: 'Generar enfrentamientos' }).click();
  await confirm(page, 'Generar enfrentamientos');
  await expect(page.getByText('Enfrentamientos generados.')).toBeVisible();
  await expect(page.getByRole('group', { name: /Bracket/ })).toBeVisible();
  await expect(page.getByText('Semifinales')).toBeVisible();
  await expect(page.getByText('Final', { exact: true })).toBeVisible();
});

test('a team without check-in loses by forfeit when staff closes the window', async ({ page }) => {
  const [semi] = (await board()).filter((m) => m.round === 1);
  if (!semi) throw new Error('no semifinal');
  const present = captainOf(semi.entrantA?.displayName);
  await api(staff, 'POST', `/admin/matches/${semi.id}/actions/open_checkin`);

  await signIn(page, present, '/app/partidas');
  await page
    .getByRole('link', { name: new RegExp(semi.entrantB?.displayName ?? '') })
    .first()
    .click();
  await page.getByRole('button', { name: 'Hacer check-in' }).click();
  await expect(page.getByText('Check-in registrado.')).toBeVisible();

  await signIn(page, staff, `/admin/torneos/${tournamentId}/partidas/${semi.id}`);
  await page.getByRole('button', { name: 'Cerrar check-in' }).click();
  await confirm(page, 'Cerrar check-in');
  await expect(page.getByText('Check-in cerrado.')).toBeVisible();
  await expect(page.getByText('Por forfeit').first()).toBeVisible();
});

test('different reports go to dispute and staff resolves it', async ({ page }) => {
  const semi = (await board()).filter((m) => m.round === 1)[1];
  if (!semi) throw new Error('no semifinal');
  const a = captainOf(semi.entrantA?.displayName);
  const b = captainOf(semi.entrantB?.displayName);
  await api(staff, 'POST', `/admin/matches/${semi.id}/actions/open_checkin`);
  await api(a, 'POST', `/matches/${semi.id}/checkin`);
  await api(b, 'POST', `/matches/${semi.id}/checkin`);

  await signIn(page, a, `/app/partidas/${semi.id}`);
  await page.getByLabel(semi.entrantA?.displayName ?? '').check();
  await page.getByRole('button', { name: 'Enviar reporte' }).click();
  await expect(page.getByText('Reporte enviado.')).toBeVisible();
  await api(b, 'POST', `/matches/${semi.id}/report`, { games: [{ number: 1, winner: 'b' }] });

  await signIn(page, staff, `/admin/torneos/${tournamentId}/partidas/${semi.id}`);
  await expect(page.getByText('Los capitanes reportaron ganadores distintos.')).toBeVisible();
  await page
    .getByLabel(semi.entrantB?.displayName ?? '')
    .first()
    .check();
  await page
    .getByLabel('Resolución')
    .fill('La captura del lobby muestra la victoria del equipo B.');
  await page.getByRole('button', { name: 'Resolver' }).click();
  await expect(page.getByText('Disputa resuelta.')).toBeVisible();
  await expect(page.getByText('Corregido por el staff')).toBeVisible();
});

test('the public page shows the bracket and the champion live', async ({ page }) => {
  await page.goto(`/torneos/${slug}`);
  await expect(page.getByText('En vivo: se actualiza solo')).toBeVisible();
  const final = (await board()).find((m) => m.round === 2);
  if (!final?.entrantA || !final.entrantB) throw new Error('final not ready');
  const a = captainOf(final.entrantA.displayName);
  const b = captainOf(final.entrantB.displayName);
  await api(staff, 'POST', `/admin/matches/${final.id}/actions/open_checkin`);
  await api(a, 'POST', `/matches/${final.id}/checkin`);
  await api(b, 'POST', `/matches/${final.id}/checkin`);
  await api(a, 'POST', `/matches/${final.id}/report`, { games: [{ number: 1, winner: 'a' }] });
  await api(b, 'POST', `/matches/${final.id}/report`, { games: [{ number: 1, winner: 'a' }] });

  // No reload: Supabase Realtime refreshes the board.
  await expect(page.getByText('Campeón', { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(final.entrantA.displayName).first()).toBeVisible();
  await expect(page.getByText('Finalizado').first()).toBeVisible();
});

test('staff uploads the match data of the final and the stats appear', async ({ page }) => {
  const final = (await board()).find((m) => m.round === 2);
  if (!final?.entrantA || !final.entrantB) throw new Error('final not played');
  const a = captainOf(final.entrantA.displayName);
  const b = captainOf(final.entrantB.displayName);
  // A fictional Match-V5 game: A (the champion) on blue, B on red.
  const data = demoMatchData({
    key: `e2e-${runId}`,
    blue: [await puuidOf(a.id)],
    red: [await puuidOf(b.id)],
    blueWins: true,
    endedAt: new Date(),
  });

  await signIn(page, staff, `/admin/torneos/${tournamentId}/partidas/${final.id}`);
  await expect(page.getByText('Datos de partida')).toBeVisible();
  await page.getByRole('button', { name: 'Cargar datos' }).click();
  await page.getByLabel('JSON de Match-V5').fill(JSON.stringify(data));
  await page.getByRole('button', { name: 'Guardar datos' }).click();
  await expect(page.getByText(/Datos guardados/)).toBeVisible();
  await expect(page.getByText('Con datos')).toBeVisible();

  // The worker derives the stats in a few seconds.
  await expect
    .poll(
      async () => {
        const stats = (await api(staff, 'GET', `/public/matches/${final.id}/stats`)) as {
          games: { hasData: boolean }[];
        };
        return stats.games[0]?.hasData ?? false;
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  await page.goto(`/torneos/${slug}/partidas/${final.id}`);
  await expect(page.getByRole('heading', { name: 'Estadísticas' })).toBeVisible();
  await expect(page.getByText('MVP', { exact: true })).toBeVisible();

  await page.goto(`/jugadores/${a.username}`);
  await expect(page.getByRole('img', { name: /^Radar de/ })).toBeVisible();
  await expect(page.getByText('Campeones más jugados')).toBeVisible();
});

test('a player follows a team, sees it in their list and unfollows it', async ({ page }) => {
  const fan = captains[3] as Captain;
  const followed = captains[0] as Captain;
  const teamSlug = followed.teamSlug;
  await signIn(page, fan, `/equipos/${teamSlug}`);
  await expect(page.getByText('0 seguidores')).toBeVisible();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await expect(page.getByText('1 seguidor', { exact: true })).toBeVisible();

  await page.goto('/app/siguiendo');
  await expect(page.getByRole('link', { name: followed.team })).toBeVisible();
  await page.getByRole('button', { name: 'Dejar de seguir' }).click();
  await expect(page.getByText(`Dejaste de seguir a ${followed.team}.`)).toBeVisible();
  // Who follows whom is private: another user sees only the count.
  const other = captains[1] as Captain;
  const state = (await api(other, 'GET', `/public/teams/${teamSlug}/stats`)) as {
    follow: { followers: number; following: boolean };
  };
  expect(state.follow).toEqual({ followers: 0, following: false });
});
