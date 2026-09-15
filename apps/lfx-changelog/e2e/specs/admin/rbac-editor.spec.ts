// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { AdminDashboardPage } from '../../pages/admin-dashboard.page.js';
import { AdminLayoutPage } from '../../pages/admin-layout.page.js';
import { ChangelogListPage } from '../../pages/changelog-list.page.js';
import { ProductDetailPage } from '../../pages/product-detail.page.js';

test.describe('RBAC — Editor', () => {
  test.use({ storageState: './e2e/.auth/editor.json' });

  test('should access the admin dashboard', async ({ page }) => {
    const dashboardPage = new AdminDashboardPage(page);
    await dashboardPage.goto();
    await expect(dashboardPage.heading).toBeVisible();
  });

  test('should access the changelogs list', async ({ page }) => {
    const listPage = new ChangelogListPage(page);
    await listPage.goto();
    await expect(listPage.heading).toBeVisible();
  });

  test('should see the new entry button', async ({ page }) => {
    const listPage = new ChangelogListPage(page);
    await listPage.goto();
    await expect(listPage.newEntryBtn).toBeVisible();
  });

  test('should not have access to user management', async ({ page }) => {
    await page.goto('/admin/users');
    const heading = page.locator('[data-testid="user-management-heading"]');
    await expect(heading).not.toBeVisible();
  });

  test('should see sidebar navigation without Users or Repositories links', async ({ page }) => {
    const layout = new AdminLayoutPage(page);
    await page.goto('/admin');
    await expect(layout.sidebar).toBeVisible();
    await expect(layout.navDashboard).toBeVisible();
    await expect(layout.navChangelogs).toBeVisible();
    await expect(layout.navRepositories).not.toBeVisible();
    await expect(layout.navUsers).not.toBeVisible();
  });

  test('should not see the Release action, which requires product admin', async ({ page }) => {
    const res = await page.request.get('/api/products');
    const products = (await res.json()).data as { id: string; slug: string }[];
    const easycla = products.find((p) => p.slug === 'e2e-easycla');
    expect(easycla, 'seeded product e2e-easycla is missing').toBeDefined();

    const detail = new ProductDetailPage(page);
    await detail.goto(easycla!.id);
    await detail.switchTab('repositories');

    // The table itself is readable by an editor; the sync and publish actions are withheld.
    await expect(page.locator('lfx-table')).toBeVisible();
    await expect(page.locator('[data-testid^="product-repo-create-release-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="product-repo-sync-"]')).toHaveCount(0);
  });
});
