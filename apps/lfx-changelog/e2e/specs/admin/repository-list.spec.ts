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

/**
 * The dialog loads its branches from GitHub, which the E2E environment has no credentials for,
 * so these cover the wiring and the failure path rather than a successful publish.
 */
test.describe('Admin Repository List — create release dialog', () => {
  let repoListPage: RepositoryListPage;

  test.beforeEach(async ({ page }) => {
    repoListPage = new RepositoryListPage(page);
    await repoListPage.goto();
  });

  test('should offer a Release action on every repository row', async () => {
    await expect(repoListPage.groupsContainer).toBeVisible();
    expect(await repoListPage.getReleaseButtons().count()).toBeGreaterThan(0);
  });

  test('should open the create release dialog', async () => {
    await repoListPage.getReleaseButtons().first().click();
    await expect(repoListPage.releaseDialog).toBeVisible();
  });

  test('should surface a readable error rather than spinning forever when GitHub is unreachable', async () => {
    await repoListPage.getReleaseButtons().first().click();
    await expect(repoListPage.releaseDialog).toBeVisible();

    await expect(repoListPage.releaseDialogError).toBeVisible({ timeout: 15000 });
    await expect(repoListPage.releaseDialogLoading).not.toBeVisible();
  });

  test('should keep publish disabled while the form cannot be submitted', async () => {
    await repoListPage.getReleaseButtons().first().click();
    await expect(repoListPage.releaseDialog).toBeVisible();
    await expect(repoListPage.releaseDialogError).toBeVisible({ timeout: 15000 });

    // The target never loaded, so there is nothing valid to publish.
    await expect(repoListPage.releaseSubmit).toBeDisabled();
  });
});

/** Reads seeded rows rather than GitHub, so unlike the create dialog this asserts a real render. */
test.describe('Admin Repository List — release history', () => {
  let repoListPage: RepositoryListPage;

  test.beforeEach(async ({ page }) => {
    repoListPage = new RepositoryListPage(page);
    await repoListPage.goto();
  });

  test('should open the release history from the release count', async () => {
    const counts = repoListPage.getReleaseHistoryButtons();
    expect(await counts.count()).toBeGreaterThan(0);

    await counts.first().click();
    await expect(repoListPage.historyDialog).toBeVisible();

    await expect(repoListPage.historyList).toBeVisible({ timeout: 15000 });
    await expect(repoListPage.historyList).toContainText('v1.1.0');
    // Drafts are excluded from both the count and this list.
    await expect(repoListPage.historyList).not.toContainText('v1.3.0-draft');
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
