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

  test('should display the sync button, disabled until a product is chosen', async () => {
    await expect(contributorsPage.syncBtn).toBeVisible();
    await expect(contributorsPage.syncBtn).toContainText('Sync from GitHub');
    await expect(contributorsPage.syncBtn.locator('button')).toBeDisabled();
    await expect(contributorsPage.syncHint).toBeVisible();
  });

  test('should enable sync once a product is selected', async () => {
    await contributorsPage.selectOption(contributorsPage.productFilter, 'E2E EasyCLA');
    await expect(contributorsPage.syncBtn.locator('button')).toBeEnabled();
  });

  test('should display the filter controls', async () => {
    await expect(contributorsPage.searchInput).toBeVisible();
    await expect(contributorsPage.productFilter).toBeVisible();
    await expect(contributorsPage.slackFilter).toBeVisible();
  });

  test('should list seeded contributors and hide bots by default', async () => {
    await expect(contributorsPage.getRows().first()).toBeVisible();
    await expect(contributorsPage.table).toContainText('e2e-octo-dev');
    await expect(contributorsPage.table).not.toContainText('e2e-testbot');
  });

  test('should show the Slack name for a linked contributor', async () => {
    const row = contributorsPage.getRowByLogin('e2e-linked-dev');
    await expect(row).toContainText('E2E Linked Dev');
    await expect(row.locator('img[alt="Slack"]')).toBeVisible();
  });

  test('should filter to unlinked contributors', async () => {
    await contributorsPage.selectOption(contributorsPage.slackFilter, 'Not linked');
    await expect(contributorsPage.table).toContainText('e2e-octo-dev');
    await expect(contributorsPage.table).not.toContainText('e2e-linked-dev');
  });

  test('should filter to linked contributors', async () => {
    await contributorsPage.selectOption(contributorsPage.slackFilter, 'Linked to Slack');
    await expect(contributorsPage.table).toContainText('e2e-linked-dev');
    await expect(contributorsPage.table).not.toContainText('e2e-octo-dev');
  });

  test('should narrow the list with a search term', async () => {
    await contributorsPage.search('octo');
    await expect(contributorsPage.table).toContainText('e2e-octo-dev');
    await expect(contributorsPage.table).not.toContainText('e2e-linked-dev');
  });

  test.describe('Link to Slack dialog', () => {
    test('should open for an unlinked contributor', async () => {
      await contributorsPage.openLinkDialogFor('e2e-octo-dev');
      await expect(contributorsPage.linkDialog).toBeVisible();
      await expect(contributorsPage.linkDialog).toContainText('e2e-octo-dev');
    });

    test('should keep the save action disabled until a Slack user is selected', async () => {
      await contributorsPage.openLinkDialogFor('e2e-octo-dev');
      await expect(contributorsPage.linkDialog).toBeVisible();
      await expect(contributorsPage.linkSaveBtn.locator('button')).toBeDisabled();
    });

    test('should surface an error when the Slack workspace is not connected', async () => {
      await contributorsPage.openLinkDialogFor('e2e-octo-dev');
      // No Slack bot installation exists in the E2E environment, so the directory fetch fails.
      await expect(contributorsPage.linkError).toBeVisible();
      await expect(contributorsPage.linkError).toContainText('Slack');
    });
  });

  // Mutating — uses a contributor reserved for this spec so the filter assertions stay stable.
  test('should unlink a contributor from Slack', async () => {
    await expect(contributorsPage.getRowByLogin('e2e-unlink-me-dev')).toContainText('E2E Unlink Me');

    await contributorsPage.openUnlinkDialogFor('e2e-unlink-me-dev');
    await expect(contributorsPage.confirmDialog).toBeVisible();
    await contributorsPage.confirmUnlink();

    await expect(contributorsPage.getRowByLogin('e2e-unlink-me-dev')).toContainText('Not linked');
  });
});
