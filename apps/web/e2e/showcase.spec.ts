import { expect, test } from '@playwright/test';

import { brand } from '../src/config/brand';
import {
  api,
  createAccount,
  deleteAccounts,
  hasDatabase,
  makeStaff,
  runId,
  type TestAccount,
} from './support/accounts';
import { signIn } from './support/sign-in';

// The public site is a showcase (docs/specs/m03): anyone can browse it, sign-in
// is always one click away and there is no dead end.
test.describe('as a guest', () => {
  test('browses the showcase from the home page', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Compite como profesional' }),
    ).toBeVisible();
    await expect(page.getByRole('banner').getByRole('link', { name: brand.name })).toBeVisible();
    await expect(page.getByText('Aún no hay partidos programados')).toBeVisible();
    await expect(page.getByText('no está respaldado por Riot Games')).toBeVisible();

    const nav = page.getByRole('banner').getByRole('navigation', { name: 'Navegación principal' });
    // Planned sections are listed but never link to a 404.
    await expect(nav.getByRole('link', { name: /Noticias/ })).toHaveCount(0);

    await page.getByRole('link', { name: 'Explorar torneos' }).click();
    await expect(page).toHaveURL('/torneos');
    await expect(page.getByRole('heading', { name: 'Tipos de torneo' })).toBeVisible();

    await nav.getByRole('link', { name: 'Equipos' }).click();
    await expect(page).toHaveURL('/equipos');
    await expect(page.getByRole('heading', { level: 1, name: 'Equipos' })).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Buscar equipos' })).toBeVisible();

    await nav.getByRole('link', { name: 'Jugadores' }).click();
    await expect(page).toHaveURL('/jugadores');
    await expect(page.getByRole('heading', { level: 1, name: 'Jugadores' })).toBeVisible();
  });

  test('reaches login and register from the header', async ({ page }) => {
    await page.goto('/equipos');
    await page.getByRole('banner').getByRole('link', { name: 'Iniciar sesión' }).click();
    // Login brings the visitor back to where they were.
    await expect(page).toHaveURL('/login?next=%2Fequipos');
    await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible();

    await page.getByRole('banner').getByRole('link', { name: 'Registrarte' }).click();
    await expect(page).toHaveURL('/register');
    await expect(page.getByRole('heading', { name: 'Crea tu cuenta' })).toBeVisible();
  });

  test('opens every legal page from the footer', async ({ page }) => {
    await page.goto('/');
    const footer = page.getByRole('contentinfo');
    for (const name of [
      'Reglamento',
      'Código de conducta',
      'Aviso de privacidad',
      'Términos de servicio',
    ]) {
      await footer.getByRole('link', { name }).click();
      await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    }
  });

  test('shows a branded 404 with a way back', async ({ page }) => {
    const response = await page.goto('/esta-pagina-no-existe');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Esta página no existe' })).toBeVisible();
    await page.getByRole('link', { name: 'Volver al inicio' }).click();
    await expect(page).toHaveURL('/');
  });

  test('uses a menu sheet on mobile, without horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await page.getByRole('button', { name: 'Abrir menú' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('link', { name: 'Registrarte' })).toBeVisible();
    await sheet.getByRole('link', { name: 'Jugadores' }).click();
    await expect(page).toHaveURL('/jugadores');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('publishes robots and a sitemap', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Disallow: /app');
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('/legal/privacidad');
  });
});

test.describe('signed in', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!hasDatabase, 'Needs SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY');

  const accounts: TestAccount[] = [];
  let carla: TestAccount;

  test.beforeAll(async () => {
    carla = await createAccount('carla');
    accounts.push(carla);
    await api(carla, 'PUT', '/me/profile', {
      displayName: 'Carla',
      username: `carla_${runId}`,
      countryCode: 'MX',
      gameRegion: 'la1',
      birthDate: '2002-03-04',
      primaryRole: 'top',
      secondaryRole: null,
      bio: '',
    });
  });

  test.afterAll(async () => {
    await deleteAccounts(accounts);
  });

  test('the header shows the account and reaches the portal in one click', async ({ page }) => {
    await signIn(page, carla);
    await page.goto('/');
    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: 'Iniciar sesión' })).toHaveCount(0);
    // The hero swaps "create account" for the portal.
    await expect(page.getByRole('link', { name: 'Ir a mi portal' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Crear cuenta para competir' })).toHaveCount(0);

    await header.getByRole('button', { name: 'Menú de cuenta' }).click();
    await expect(page.getByRole('menuitem', { name: 'Mi perfil' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Consola de administración' })).toHaveCount(0);
    await page.keyboard.press('Escape');

    await header.getByRole('link', { name: 'Mi portal' }).click();
    await expect(page).toHaveURL('/app');
    // And back to the public site from the portal shell.
    await page.getByRole('link', { name: 'Ir al sitio público' }).click();
    await expect(page).toHaveURL('/');
  });

  test('staff also sees the console', async ({ page }) => {
    await makeStaff(carla);
    await signIn(page, carla);
    await page.goto('/');
    await page.getByRole('banner').getByRole('button', { name: 'Menú de cuenta' }).click();
    await page.getByRole('menuitem', { name: 'Consola de administración' }).click();
    await expect(page).toHaveURL('/admin');
  });

  test('the player directory lists the player without private data', async ({ page }) => {
    await page.goto(`/jugadores?q=carla_${runId}`);
    const card = page.getByRole('link', { name: /Carla/ });
    await expect(card).toContainText(`@carla_${runId}`);
    await expect(card).not.toContainText('2002');
  });
});
