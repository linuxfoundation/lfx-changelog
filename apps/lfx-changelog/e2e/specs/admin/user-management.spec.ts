// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { UserManagementPage } from '../../pages/user-management.page.js';

test.describe('User Management', () => {
  let userPage: UserManagementPage;

  test.beforeEach(async ({ page }) => {
    userPage = new UserManagementPage(page);
    await userPage.goto();
  });

  test('should display heading', async () => {
    await expect(userPage.heading).toBeVisible();
    await expect(userPage.heading).toContainText('Users');
  });

  test('should display user table', async () => {
    await expect(userPage.table).toBeVisible();
  });

  test('should display table headers', async () => {
    const headers = userPage.table.locator('thead th');
    await expect(headers.nth(0)).toContainText('User');
    await expect(headers.nth(1)).toContainText('Email');
    await expect(headers.nth(2)).toContainText('Roles');
    await expect(headers.nth(3)).toContainText('Actions');
  });

  test('should display user rows', async () => {
    const rows = userPage.getRows();
    await expect(rows.first()).toBeVisible();
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display role badges for users', async () => {
    const rows = userPage.getRows();
    await expect(rows.first()).toBeVisible();
    const badge = rows.first().locator('lfx-badge');
    await expect(badge.first()).toBeVisible();
  });

  test('should display manage roles button for each user', async () => {
    const manageButtons = userPage.page.locator('[data-testid^="user-management-manage-roles-"]');
    await expect(manageButtons.first()).toBeVisible();
  });

  test('should open manage roles dialog', async () => {
    const manageButtons = userPage.page.locator('[data-testid^="user-management-manage-roles-"]');
    await expect(manageButtons.first()).toBeVisible();
    await manageButtons.first().click();

    await expect(userPage.roleDialog).toBeVisible();
    await expect(userPage.roleSelect).toBeVisible();
    await expect(userPage.productSelect).toBeVisible();
    await expect(userPage.assignBtn).toBeVisible();
  });

  test('should close manage roles dialog', async ({ page }) => {
    const manageButtons = page.locator('[data-testid^="user-management-manage-roles-"]');
    await expect(manageButtons.first()).toBeVisible();
    await manageButtons.first().click();
    await expect(userPage.roleDialog).toBeVisible();

    const closeBtn = page.locator('[data-testid="dialog-close-btn"]');
    await closeBtn.click();
    await expect(userPage.roleDialog).not.toBeVisible();
  });
});
