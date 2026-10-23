import { expect, test } from '@playwright/test';

test.describe('protected zones', () => {
  for (const path of ['/app', '/admin']) {
    test(`${path} redirects to login without a session`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL(`/login?next=${encodeURIComponent(path)}`);
    });
  }
});
