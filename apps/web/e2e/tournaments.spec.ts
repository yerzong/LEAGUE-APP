import { expect, type Page, test } from '@playwright/test';

import {
  api,
  createAccount,
  deleteAccounts,
  deleteTemplates,
  deleteTournaments,
  hasDatabase,
  runId,
  staffAccount,
  type TestAccount,
} from './support/accounts';
import { signIn } from './support/sign-in';

// docs/specs/m04: staff creates a tournament with the wizard, saves it as a
// draft, publishes it (empty phases), opens registration; a captain checks
// eligibility in the portal and registers; anti-chapulineo blocks a player in
// two rosters; staff approves and it is audited; the public page lists it.
test.describe.configure({ mode: 'serial' });
test.skip(!hasDatabase, 'Needs SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY');

const accounts: TestAccount[] = [];
let staff: TestAccount;
let ana: TestAccount;
let beto: TestAccount;
let carla: TestAccount;
const name = `E2E Relampago ${runId}`;
const slugPrefix = `e2e-relampago-${runId}`;
const auroraName = `Aurora ${runId}`;
const borealName = `Boreal ${runId}`;
const tag = (letter: string) =>
  `${letter}${runId.slice(-3).toUpperCase()}`.replace(/[^A-Z0-9]/g, 'X');
let tournamentPath = '';

/** `YYYY-MM-DDT18:00` in `days` from today (datetime-local of the event time zone). */
function dayAt(days: number): string {
  const date = new Date(Date.now() + days * 24 * 3600 * 1000);
  return `${date.toISOString().slice(0, 10)}T18:00`;
}

async function choose(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

async function readyPlayer(account: TestAccount, displayName: string, username: string) {
  await api(account, 'PUT', '/me/profile', {
    displayName,
    username,
    countryCode: 'MX',
    gameRegion: 'la1',
    birthDate: '2003-02-01',
    primaryRole: 'mid',
    secondaryRole: null,
    bio: '',
  });
  const attempt = (await api(account, 'POST', '/me/riot-account/verifications', {
    gameName: `T${displayName} ${runId}`,
    tagLine: 'E2E',
    region: 'la1',
  })) as { id: string };
  await api(account, 'POST', `/me/riot-account/verifications/${attempt.id}/confirm`);
}

async function teamWith(
  captain: TestAccount,
  teamName: string,
  teamTag: string,
  player: TestAccount,
) {
  const team = (await api(captain, 'POST', '/teams', {
    name: teamName,
    tag: teamTag,
    region: 'la1',
    description: '',
  })) as { id: string };
  const invitation = (await api(captain, 'POST', `/teams/${team.id}/invitations`, {
    kind: 'user',
    userId: player.id,
    teamRole: 'player',
  })) as { id: string };
  await api(player, 'POST', `/invitations/${invitation.id}/accept`);
}

test.beforeAll(async () => {
  // Several accounts, Riot links and teams: longer than a test.
  test.setTimeout(180_000);
  staff = await staffAccount();
  ana = await createAccount('t-ana');
  beto = await createAccount('t-beto');
  carla = await createAccount('t-carla');
  accounts.push(ana, beto, carla);
  await readyPlayer(ana, 'Ana', `tana_${runId}`);
  await readyPlayer(beto, 'Beto', `tbeto_${runId}`);
  await readyPlayer(carla, 'Carla', `tcarla_${runId}`);
  // Beto plays for both teams: registering him twice is the chapulineo case.
  await teamWith(ana, auroraName, tag('A'), beto);
  await teamWith(carla, borealName, tag('B'), beto);
});

test.afterAll(async () => {
  await deleteTournaments(slugPrefix);
  await deleteTemplates(name);
  await deleteAccounts(accounts);
});

test('staff creates a draft with the wizard and publishes it', async ({ page }) => {
  await signIn(page, staff, '/admin');
  await page.goto('/admin/torneos');
  await page.getByRole('link', { name: 'Nuevo torneo' }).first().click();
  await expect(page).toHaveURL('/admin/torneos/nuevo');

  await page.getByLabel('Nombre del torneo').fill(name);
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByLabel('Cupo (participantes)').fill('4');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await choose(page, 'Tamaño de equipo', '2v2');
  await choose(page, 'Mapa', 'Abismo de los Lamentos');

  await page.getByRole('button', { name: 'Calendario' }).click();
  await page.getByLabel('Abren inscripciones').fill(dayAt(-1));
  await page.getByLabel('Cierran inscripciones').fill(dayAt(7));
  await page.getByLabel('Inicio del torneo').fill(dayAt(10));

  // A draft can be saved at any step.
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByText('Borrador guardado.')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/torneos\/[0-9a-f-]+\/editar\?paso=schedule/);
  tournamentPath = new URL(page.url()).pathname.replace(/\/editar$/, '');

  await page.getByRole('button', { name: 'Revisión' }).click();
  await expect(page.getByText('Escribe el reglamento (paso Revisión).')).toBeVisible();
  await expect(page.getByText(/4 participantes · 2 rondas · 3 series/)).toBeVisible();
  await page
    .getByLabel('Contenido')
    .fill('# Reglamento\n\nJuega limpio. Check-in 30 minutos antes.');
  await page.getByRole('button', { name: 'Guardar reglamento' }).click();
  await expect(page.getByText('Reglamento guardado.')).toBeVisible();
  await expect(page.getByText('Todo listo para publicar.').first()).toBeVisible();

  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Publicar' }).click();
  await expect(page).toHaveURL(tournamentPath);
  await expect(page.getByText('Próximamente').first()).toBeVisible();

  // Publishing created the (empty) phase structure for the format.
  await page.getByRole('tab', { name: 'Fases y bracket' }).click();
  await expect(page.getByText('1. Eliminación directa')).toBeVisible();

  // After publishing, eligibility changes need a confirmation (docs/14 §3.2).
  await page.goto(`${tournamentPath}/editar?paso=eligibility`);
  await expect(page.getByText(/te pedirá confirmación al guardar/)).toBeVisible();
});

test('staff opens registration', async ({ page }) => {
  await signIn(page, staff, tournamentPath);
  await page.getByRole('button', { name: 'Abrir inscripciones' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Abrir inscripciones' }).click();
  await expect(page.getByText('Listo: Inscripciones abiertas.')).toBeVisible();
});

test('a captain sees the eligibility indicator and registers a roster', async ({ page }) => {
  await signIn(page, ana, '/app');
  await page.getByRole('link', { name: 'Torneos' }).first().click();
  await expect(page).toHaveURL('/app/torneos');
  const card = page.getByRole('listitem').filter({ hasText: name });
  await expect(card.getByText(`${auroraName} es elegible`)).toBeVisible();
  await card.getByRole('link', { name: 'Inscribirme' }).click();

  await expect(page.getByText('Todo en orden: el roster cumple las reglas.')).toBeVisible();
  await page.getByLabel('Leí y acepto el reglamento').click();
  await page.getByRole('button', { name: 'Enviar inscripción' }).click();
  await expect(page.getByText('Inscripción enviada. El staff la revisará.')).toBeVisible();
  await expect(page.getByText('Pendiente').first()).toBeVisible();
});

test('anti-chapulineo: a player already registered blocks another roster', async ({ page }) => {
  await signIn(page, carla, `/app/torneos/${slugPrefix}`);
  await expect(
    page.getByText('Beto: Ya está en otra inscripción del mismo ámbito (anti-chapulineo).'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar inscripción' })).toBeDisabled();
});

test('staff approves the registration and it is audited', async ({ page }) => {
  await signIn(page, staff, `${tournamentPath}?tab=registrations`);
  const card = page.locator('[data-slot="card"]').filter({ hasText: auroraName });
  await expect(card.getByText('Elegible', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Aprobar' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Aprobar' }).click();
  await expect(page.getByText('Inscripción aprobada.')).toBeVisible();

  await page.getByRole('tab', { name: 'Auditoría' }).click();
  await expect(page.getByText('Aprobó una inscripción')).toBeVisible();
  await expect(page.getByText('Publicó el torneo')).toBeVisible();
});

test('the public site lists the tournament with its participants', async ({ page }) => {
  await page.goto('/torneos');
  await page.getByRole('link', { name: new RegExp(name) }).click();
  await expect(page).toHaveURL(`/torneos/${slugPrefix}`);
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(page.getByText(auroraName)).toBeVisible();
  await expect(page.getByText('Juega limpio. Check-in 30 minutos antes.')).toBeVisible();
});
