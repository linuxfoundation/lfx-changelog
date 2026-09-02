// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { AdminLayoutPage } from '../../pages/admin-layout.page.js';
import { ReleaseListPage } from '../../pages/release-list.page.js';

test.describe('Release list RBAC', () => {
  test.describe('editor', () => {
    test.use({ storageState: './e2e/.auth/editor.json' });

    test('hides Create a new release and denies the page', async ({ page }) => {
      const layout = new AdminLayoutPage(page);
      const releaseList = new ReleaseListPage(page);
      await page.goto('/admin');
      await expect(layout.navReleaseJobs).not.toBeVisible();
      await releaseList.goto();
      await expect(releaseList.heading).not.toBeVisible();
      await expect(layout.sidebar).toBeVisible();
    });
  });

  test.describe('product_admin', () => {
    test.use({ storageState: './e2e/.auth/product-admin.json' });

    test('shows Create a new release and the catalog heading', async ({ page }) => {
      const layout = new AdminLayoutPage(page);
      const releaseList = new ReleaseListPage(page);
      await page.goto('/admin');
      await expect(layout.navReleaseJobs).toBeVisible();
      await releaseList.goto();
      await expect(releaseList.heading).toBeVisible();
    });
  });

  test.describe('super_admin', () => {
    test.use({ storageState: './e2e/.auth/super-admin.json' });

    test('shows the full catalog page', async ({ page }) => {
      const releaseList = new ReleaseListPage(page);
      await releaseList.goto();
      await expect(releaseList.heading).toBeVisible();
    });
  });
});
