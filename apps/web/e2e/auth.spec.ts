import { expect, test } from '@playwright/test';

test.describe('protected zones', () => {
  for (const path of ['/app', '/admin']) {
    test(`${path} redirects to login without a session`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL(`/login?next=${encodeURIComponent(path)}`);
    });
  }
});

test('login offers Discord, email + password and magic link', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('button', { name: 'Continuar con Discord' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar enlace' })).toBeVisible();
});

test('register validates the password before calling Supabase', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Correo').fill('ana@test.local');
  await page.getByLabel('Contraseña').evaluate((input: HTMLInputElement) => {
    input.removeAttribute('minlength');
  });
  await page.getByLabel('Contraseña').fill('short');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  // Filtered by text: Next.js renders its own empty role="alert" route announcer.
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'La contraseña debe tener entre 8 y 72 caracteres.' }),
  ).toBeVisible();
});
