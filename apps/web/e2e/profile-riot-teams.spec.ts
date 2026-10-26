import { expect, type Page, test } from '@playwright/test';

import {
  api,
  createAccount,
  deleteAccounts,
  hasDatabase,
  runId,
  type TestAccount,
} from './support/accounts';
import { signIn } from './support/sign-in';

// The pilot flow (docs/specs/m02): complete the profile, link Riot (stub),
// create a team, invite a player who accepts. Needs a real Supabase project.
test.describe.configure({ mode: 'serial' });
test.skip(!hasDatabase, 'Needs SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY');

const accounts: TestAccount[] = [];
let ana: TestAccount;
let beto: TestAccount;
const anaUsername = `ana_${runId}`;
const betoUsername = `beto_${runId}`;
const teamName = `Aurora ${runId}`;
const teamTag = `A${runId.slice(-4).toUpperCase()}`.replace(/[^A-Z0-9]/g, 'X');

async function choose(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

test.beforeAll(async () => {
  ana = await createAccount('ana');
  beto = await createAccount('beto');
  accounts.push(ana, beto);
  // Beto is ready to compete; preparing him is not the flow under test.
  await api(beto, 'PUT', '/me/profile', {
    displayName: 'Beto',
    username: betoUsername,
    countryCode: 'MX',
    gameRegion: 'la1',
    birthDate: '2003-02-01',
    primaryRole: 'adc',
    secondaryRole: null,
    bio: '',
  });
  const attempt = (await api(beto, 'POST', '/me/riot-account/verifications', {
    gameName: `Beto ${runId}`,
    tagLine: 'E2E',
    region: 'la1',
  })) as { id: string };
  await api(beto, 'POST', `/me/riot-account/verifications/${attempt.id}/confirm`);
});

test.afterAll(async () => {
  await deleteAccounts(accounts);
});

test('completes the profile', async ({ page }) => {
  await signIn(page, ana);
  await expect(page.getByText('Completa tu perfil para competir')).toBeVisible();

  await page.goto('/app/perfil');
  await page.getByLabel('Nombre visible').fill('Ana López');
  await page.getByLabel('Nombre de usuario').fill(anaUsername);
  await choose(page, 'País', 'México');
  await choose(page, 'Región de juego', 'LAN');
  await page.getByLabel('Fecha de nacimiento').fill('2004-05-10');
  await choose(page, 'Rol principal', 'Medio');
  await choose(page, 'Rol secundario', 'Soporte');
  await page.getByLabel('Biografía').fill('Mid main desde la temporada 9.');
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page.getByText('Cambios guardados.')).toBeVisible();
  // Only the Riot account is left in the onboarding list.
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Vincular tu cuenta de Riot' }),
  ).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Nombre de usuario' })).toHaveCount(0);
});

test('links the Riot account with the icon method', async ({ page }) => {
  await signIn(page, ana);
  await page.goto('/app/riot');
  await page.getByLabel('Nombre de invocador').fill(`Ana ${runId}`);
  await page.getByLabel('Tag').fill('E2E');
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByText('Confirma que la cuenta es tuya')).toBeVisible();
  await expect(page.getByTestId('expected-icon')).toHaveText(/Ícono \d+/);
  await page.getByRole('button', { name: 'Ya lo cambié' }).click();

  await expect(page.getByText('Cuenta vinculada y verificada.')).toBeVisible();
  await expect(page.getByText('Cuenta vinculada', { exact: true })).toBeVisible();
  await expect(page.getByText(`Ana ${runId}`)).toBeVisible();
});

test('creates a team', async ({ page }) => {
  await signIn(page, ana);
  await page.goto('/app/equipos/nuevo');
  await page.getByLabel('Nombre', { exact: true }).fill(teamName);
  await page.getByLabel('Tag').fill(teamTag);
  await page.getByRole('button', { name: 'Crear equipo' }).click();

  await expect(page).toHaveURL(new RegExp(`/app/equipos/aurora-${runId}$`));
  await expect(page.getByRole('heading', { name: teamName })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Ana López' })).toBeVisible();
});

test('invites a player who accepts', async ({ page, browser }) => {
  await signIn(page, ana);
  await page.goto(`/app/equipos/aurora-${runId}`);
  await page.getByLabel('Buscar jugador').fill(betoUsername.slice(0, 8));
  const result = page.getByRole('listitem').filter({ hasText: `@${betoUsername}` });
  await result.getByRole('button', { name: 'Invitar' }).click();
  await expect(page.getByText('Invitación enviada.')).toBeVisible();

  const betoContext = await browser.newContext();
  const betoPage = await betoContext.newPage();
  await signIn(betoPage, beto);
  const invitation = betoPage.getByRole('listitem').filter({ hasText: teamName });
  await expect(invitation).toContainText('te invita como Titular');
  await invitation.getByRole('button', { name: 'Aceptar' }).click();

  await expect(betoPage).toHaveURL(new RegExp(`/app/equipos/aurora-${runId}$`));
  const betoRow = betoPage
    .getByRole('row')
    .filter({ has: betoPage.getByRole('link', { name: 'Beto', exact: true }) });
  await expect(betoRow).toContainText('Titular');
  await betoContext.close();

  // The public page shows the roster without a session.
  const anonymous = await browser.newContext();
  const publicPage = await anonymous.newPage();
  await publicPage.goto(`/equipos/aurora-${runId}`);
  await expect(publicPage.getByRole('heading', { name: teamName })).toBeVisible();
  await expect(publicPage.getByRole('link', { name: 'Ana López' })).toBeVisible();
  await expect(publicPage.getByRole('link', { name: 'Beto' })).toBeVisible();
  // The directory lists the real team, and the roster leads to the player through it.
  await publicPage.goto(`/equipos?q=${encodeURIComponent(teamName)}`);
  await expect(publicPage.getByRole('link', { name: new RegExp(teamName) })).toContainText(
    '2 integrantes',
  );
  await publicPage.goto(`/equipos/aurora-${runId}`);
  await publicPage.getByRole('link', { name: 'Ana López' }).click();
  const trail = publicPage.getByRole('navigation', { name: 'Ruta de navegación' });
  await expect(trail.getByRole('link', { name: teamName })).toBeVisible();
  await publicPage.goto(`/jugadores/${anaUsername}`);
  await expect(publicPage.getByText(`Riot ID verificado: Ana ${runId}#E2E`)).toBeVisible();
  await anonymous.close();
});
