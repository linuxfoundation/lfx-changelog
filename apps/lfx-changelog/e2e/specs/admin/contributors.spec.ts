// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { ContributorsPage } from '../../pages/contributors.page.js';

test.describe('Contributors', () => {
  let contributorsPage: ContributorsPage;

  test.beforeEach(async ({ page }) => {
    contributorsPage = new ContributorsPage(page);
    await contributorsPage.goto();
  });

  test('should display heading', async () => {
    await expect(contributorsPage.heading).toBeVisible();
    await expect(contributorsPage.heading).toContainText('Contributors');
  });

  test('should display the contributors table', async () => {
    await expect(contributorsPage.table).toBeVisible();
  });

  test('should display table headers', async () => {
    const headers = contributorsPage.table.locator('thead th');
    await expect(headers.nth(0)).toContainText('Contributor');
    await expect(headers.nth(1)).toContainText('Products');
    await expect(headers.nth(2)).toContainText('Commits');
    await expect(headers.nth(3)).toContainText('Slack');
  });

  test('should display the sync button', async () => {
    await expect(contributorsPage.syncBtn).toBeVisible();
    await expect(contributorsPage.syncBtn).toContainText('Sync from GitHub');
  });

  test('should display the filter controls', async () => {
    await expect(contributorsPage.searchInput).toBeVisible();
    await expect(contributorsPage.productFilter).toBeVisible();
    await expect(contributorsPage.slackFilter).toBeVisible();
  });

  test('should filter to unlinked contributors without error', async () => {
    await contributorsPage.selectOption(contributorsPage.slackFilter, 'Not linked');
    await expect(contributorsPage.table).toBeVisible();
  });

  test('should accept a search term without error', async () => {
    await contributorsPage.searchInput.locator('input').fill('octocat');
    await expect(contributorsPage.table).toBeVisible();
  });
});
