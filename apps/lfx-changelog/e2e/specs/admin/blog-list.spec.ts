// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { BlogListPage } from '../../pages/blog-list.page.js';

test.describe('Blog List', () => {
  let listPage: BlogListPage;

  test.beforeEach(async ({ page }) => {
    listPage = new BlogListPage(page);
    await listPage.goto();
  });

  test('should display heading', async () => {
    await expect(listPage.heading).toBeVisible();
    await expect(listPage.heading).toContainText('Blog');
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
    await expect(headers.nth(1)).toContainText('Type');
    await expect(headers.nth(2)).toContainText('Status');
    await expect(headers.nth(3)).toContainText('Products');
    await expect(headers.nth(4)).toContainText('Updated');
  });

  test('should display the new post button', async () => {
    await expect(listPage.newPostBtn).toBeVisible();
  });

  test('should navigate to new post form', async ({ page }) => {
    await listPage.newPostBtn.click();
    await page.waitForURL(/\/admin\/blog\/new/);
  });

  test('should display type filter', async () => {
    await expect(listPage.typeFilter).toBeVisible();
  });

  test('should display status filter', async () => {
    await expect(listPage.statusFilter).toBeVisible();
  });

  test('should navigate to edit when clicking entry title', async ({ page }) => {
    const rows = listPage.getRows();
    await expect(rows.first()).toBeVisible();
    const firstLink = rows.first().locator('a');
    await firstLink.click();
    await page.waitForURL(/\/admin\/blog\/.*\/edit/);
  });

  test('should show entries with status badges', async () => {
    const rows = listPage.getRows();
    await expect(rows.first()).toBeVisible();
    const badge = rows.first().locator('lfx-status-badge');
    await expect(badge).toBeVisible();
  });

  test('should show Delete option in actions menu', async ({ page }) => {
    const rows = listPage.getRows();
    await expect(rows.first()).toBeVisible();
    await listPage.actionsBtn.first().click();
    const deleteOption = page.locator('body > div').getByText('Delete');
    await expect(deleteOption).toBeVisible();
  });

  test('should show Unpublish option for published entries', async ({ page }) => {
    const publishedRow = listPage.getRows().filter({ has: page.locator('lfx-status-badge:has-text("Published")') });
    await expect(publishedRow.first()).toBeVisible();
    const actionsBtn = publishedRow.first().locator('[data-testid="blog-list-actions-btn"]');
    await actionsBtn.click();
    const unpublishOption = page.locator('body > div').getByText('Unpublish');
    await expect(unpublishOption).toBeVisible();
  });

  test('should not show Unpublish option for draft entries', async ({ page }) => {
    const draftRow = listPage.getRows().filter({ has: page.locator('lfx-status-badge:has-text("Draft")') });
    await expect(draftRow.first()).toBeVisible();
    const actionsBtn = draftRow.first().locator('[data-testid="blog-list-actions-btn"]');
    await actionsBtn.click();
    const unpublishOption = page.locator('body > div').getByText('Unpublish');
    await expect(unpublishOption).not.toBeVisible();
  });
});
