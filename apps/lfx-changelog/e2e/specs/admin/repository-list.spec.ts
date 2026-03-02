// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { AdminLayoutPage } from '../../pages/admin-layout.page.js';
import { RepositoryListPage } from '../../pages/repository-list.page.js';

test.describe('Admin Repository List', () => {
  let repoListPage: RepositoryListPage;
  let layoutPage: AdminLayoutPage;

  test.beforeEach(async ({ page }) => {
    repoListPage = new RepositoryListPage(page);
    layoutPage = new AdminLayoutPage(page);
    await repoListPage.goto();
  });

  test('should display repository list heading', async () => {
    await expect(repoListPage.heading).toBeVisible();
    await expect(repoListPage.heading).toContainText('Repositories');
  });

  test('should show empty state or grouped repositories', async () => {
    // The page should either show the empty state or the groups container
    const emptyVisible = await repoListPage.emptyState.isVisible().catch(() => false);
    const groupsVisible = await repoListPage.groupsContainer.isVisible().catch(() => false);
    expect(emptyVisible || groupsVisible).toBe(true);
  });

  test('should show Repositories link in sidebar for super admin', async () => {
    await expect(layoutPage.navRepositories).toBeVisible();
  });

  test('should navigate to repositories page via sidebar', async ({ page }) => {
    await page.goto('/admin');
    await layoutPage.navigateToRepositories();
    await page.waitForURL(/\/admin\/repositories/);
    await expect(repoListPage.heading).toBeVisible();
  });
});

test.describe('RBAC — Repository List Access', () => {
  test.describe('product admin', () => {
    test.use({ storageState: './e2e/.auth/product-admin.json' });

    test('should not see Repositories link in sidebar', async ({ page }) => {
      const layout = new AdminLayoutPage(page);
      await page.goto('/admin');
      await expect(layout.navRepositories).not.toBeVisible();
    });

    test('should not be able to access repository list page', async ({ page }) => {
      const repoListPage = new RepositoryListPage(page);
      await repoListPage.goto();
      await expect(repoListPage.heading).not.toBeVisible();
    });
  });

  test.describe('editor', () => {
    test.use({ storageState: './e2e/.auth/editor.json' });

    test('should not see Repositories link in sidebar', async ({ page }) => {
      const layout = new AdminLayoutPage(page);
      await page.goto('/admin');
      await expect(layout.navRepositories).not.toBeVisible();
    });
  });
});
