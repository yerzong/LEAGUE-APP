import { expect, test } from '@playwright/test';

import { brand } from '../src/config/brand';

test('home shows the brand logo and the API status', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('img', { name: brand.name })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('API: ok');
});
