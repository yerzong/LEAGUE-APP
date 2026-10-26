import { expect, type Page } from '@playwright/test';

import type { TestAccount } from './accounts';

export async function signIn(page: Page, account: TestAccount, next = '/app') {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  // The login page also has the magic link form, with its own "Correo".
  const form = page.locator('form').filter({ has: page.getByLabel('Contraseña') });
  await form.getByLabel('Correo').fill(account.email);
  await form.getByLabel('Contraseña').fill(account.password);
  await form.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(next);
}
