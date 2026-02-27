// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
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
});
