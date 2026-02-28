// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { TEST_USERS } from '../../helpers/test-data.js';
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

  test('should show "Role" label (not optional) in add user dialog', async () => {
    await userPage.openAddUserDialog();
    await expect(userPage.addUserDialog).toBeVisible();

    const roleLabel = userPage.addUserRoleSelect.locator('label');
    await expect(roleLabel).toHaveText('Role');
  });

  test('should create a new user via the add user dialog', async () => {
    const rowsBefore = userPage.getRows();
    await expect(rowsBefore.first()).toBeVisible();
    const countBefore = await rowsBefore.count();

    await userPage.openAddUserDialog();
    await expect(userPage.addUserDialog).toBeVisible();

    await userPage.addUserEmailInput.locator('input').fill(`e2e-ui-${Date.now()}@example.com`);
    await userPage.addUserNameInput.locator('input').fill('E2E UI Test User');
    await userPage.selectOption(userPage.addUserRoleSelect, 'Editor');
    await userPage.selectOption(userPage.addUserProductSelect, 'E2E EasyCLA');
    await userPage.addUserCreateBtn.click();

    await expect(userPage.addUserDialog).not.toBeVisible();
    const rowsAfter = userPage.getRows();
    await expect(rowsAfter).toHaveCount(countBefore + 1);
  });

  test('should show error for duplicate email in add user dialog', async () => {
    await userPage.openAddUserDialog();
    await expect(userPage.addUserDialog).toBeVisible();

    await userPage.addUserEmailInput.locator('input').fill(TEST_USERS[0]!.email);
    await userPage.addUserNameInput.locator('input').fill('Duplicate User');
    await userPage.selectOption(userPage.addUserRoleSelect, 'Editor');
    await userPage.selectOption(userPage.addUserProductSelect, 'E2E EasyCLA');
    await userPage.addUserCreateBtn.click();

    await expect(userPage.addUserError).toBeVisible();
    await expect(userPage.addUserDialog).toBeVisible();
  });
});
