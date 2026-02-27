// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { ChangelogFeedPage } from '../../pages/changelog-feed.page.js';

test.describe('RBAC — No Role (authenticated user)', () => {
  test.use({ storageState: './e2e/.auth/user.json' });

  test('should redirect from /admin to public feed', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForURL('/');

    const feedPage = new ChangelogFeedPage(page);
    await expect(feedPage.heading).toBeVisible();
  });

  test('should redirect from /admin/changelogs to public feed', async ({ page }) => {
    await page.goto('/admin/changelogs');
    await page.waitForURL('/');
  });

  test('should redirect from /admin/products to public feed', async ({ page }) => {
    await page.goto('/admin/products');
    await page.waitForURL('/');
  });

  test('should redirect from /admin/users to public feed', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForURL('/');
  });

  test('should still access public pages normally', async ({ page }) => {
    const feedPage = new ChangelogFeedPage(page);
    await feedPage.goto();
    await expect(feedPage.heading).toBeVisible();
    await expect(feedPage.timeline).toBeVisible();
  });
});
