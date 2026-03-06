// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { activateProduct, deactivateProduct } from '../../helpers/db.helper.js';
import { TEST_PRODUCTS } from '../../helpers/test-data.js';
import { ChangelogListPage } from '../../pages/changelog-list.page.js';

test.describe('Changelog List', () => {
  let listPage: ChangelogListPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ChangelogListPage(page);
    await listPage.goto();
  });

  test('should display heading', async () => {
    await expect(listPage.heading).toBeVisible();
    await expect(listPage.heading).toContainText('Changelogs');
  });

  test('should display the table with entries', async () => {
    await expect(listPage.table).toBeVisible();
    const rows = listPage.getRows();
    await expect(rows.first()).toBeVisible();
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display table columns', async () => {
    const headers = listPage.table.locator('thead th');
    await expect(headers.nth(0)).toContainText('Title');
    await expect(headers.nth(1)).toContainText('Product');
    await expect(headers.nth(2)).toContainText('Status');
    await expect(headers.nth(3)).toContainText('Version');
    await expect(headers.nth(4)).toContainText('Updated');
  });

  test('should display the new entry button', async () => {
    await expect(listPage.newEntryBtn).toBeVisible();
  });

  test('should navigate to new entry form', async ({ page }) => {
    await listPage.newEntryBtn.click();
    await page.waitForURL(/\/admin\/changelogs\/new/);
  });

  test('should display product filter', async () => {
    await expect(listPage.productFilter).toBeVisible();
  });

  test('should display status filter', async () => {
    await expect(listPage.statusFilter).toBeVisible();
  });

  test('should navigate to edit when clicking entry title', async ({ page }) => {
    const rows = listPage.getRows();
    await expect(rows.first()).toBeVisible();
    const firstLink = rows.first().locator('a');
    await firstLink.click();
    await page.waitForURL(/\/admin\/changelogs\/.*\/edit/);
  });

  test('should show entries with status badges', async () => {
    const rows = listPage.getRows();
    await expect(rows.first()).toBeVisible();
    const badge = rows.first().locator('lfx-status-badge');
    await expect(badge).toBeVisible();
  });

  test('should show table rows after loading completes', async () => {
    // Verify loading resolves and we get either rows or the empty message
    await expect(listPage.table.or(listPage.empty)).toBeVisible();
    const rows = listPage.getRows();
    const rowCount = await rows.count();
    if (rowCount === 0) {
      await expect(listPage.empty).toBeVisible();
    } else {
      await expect(rows.first()).toBeVisible();
    }
  });

  test('should display the Resync Search button for super admin', async () => {
    await expect(listPage.resyncBtn).toBeVisible();
    await expect(listPage.resyncBtn).toContainText('Resync Search');
  });

  test('should show reindex result after clicking Resync Search', async () => {
    await listPage.resyncBtn.click();
    await expect(listPage.resyncResult).toBeVisible({ timeout: 30_000 });
    await expect(listPage.resyncResult).toContainText('indexed');
  });

  test('should show actions menu with Post to Slack on published entries', async ({ page }) => {
    // Find a published row specifically (first row may be draft)
    const publishedRow = listPage.getRows().filter({ has: page.locator('lfx-status-badge:has-text("Published")') });
    await expect(publishedRow.first()).toBeVisible();
    const actionsBtn = publishedRow.first().locator('[data-testid="changelog-list-actions-btn"]');
    await actionsBtn.click();
    // The dropdown panel is appended to body
    const slackOption = page.locator('body > div').getByText('Post to Slack');
    await expect(slackOption).toBeVisible();
  });

  test('should show actions menu with Delete option', async ({ page }) => {
    const rows = listPage.getRows();
    await expect(rows.first()).toBeVisible();
    await listPage.actionsBtn.first().click();
    const deleteOption = page.locator('body > div').getByText('Delete');
    await expect(deleteOption).toBeVisible();
  });

  test('should show Unpublish option for published entries', async ({ page }) => {
    // Find a row with a Published status badge
    const publishedRow = listPage.getRows().filter({ has: page.locator('lfx-status-badge:has-text("Published")') });
    await expect(publishedRow.first()).toBeVisible();
    // Click the actions button within the published row
    const actionsBtn = publishedRow.first().locator('[data-testid="changelog-list-actions-btn"]');
    await actionsBtn.click();
    const unpublishOption = page.locator('body > div').getByText('Unpublish');
    await expect(unpublishOption).toBeVisible();
  });

  test('should not show Unpublish option for draft entries', async ({ page }) => {
    // Find a row with a Draft status badge
    const draftRow = listPage.getRows().filter({ has: page.locator('lfx-status-badge:has-text("Draft")') });
    await expect(draftRow.first()).toBeVisible();
    const actionsBtn = draftRow.first().locator('[data-testid="changelog-list-actions-btn"]');
    await actionsBtn.click();
    const unpublishOption = page.locator('body > div').getByText('Unpublish');
    await expect(unpublishOption).not.toBeVisible();
  });

  test('should not show disabled product in product filter dropdown', async () => {
    const targetProduct = TEST_PRODUCTS[1]!;
    await deactivateProduct(targetProduct.slug);
    try {
      await listPage.goto();
      await listPage.productFilter.locator('button[role="combobox"]').click();

      const disabledOption = listPage.productFilter.locator('button[role="option"]', { hasText: targetProduct.name });
      await expect(disabledOption).not.toBeVisible();

      const allOption = listPage.productFilter.locator('button[role="option"]', { hasText: 'All Products' });
      await expect(allOption).toBeVisible();
    } finally {
      await activateProduct(targetProduct.slug);
    }
  });
});
