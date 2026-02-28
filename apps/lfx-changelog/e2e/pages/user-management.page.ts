// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { Locator, Page } from '@playwright/test';

export class UserManagementPage {
  public readonly heading: Locator;
  public readonly table: Locator;
  public readonly roleDialog: Locator;
  public readonly roleSelect: Locator;
  public readonly productSelect: Locator;
  public readonly assignBtn: Locator;

  // Add User dialog
  public readonly addUserBtn: Locator;
  public readonly addUserDialog: Locator;
  public readonly addUserEmailInput: Locator;
  public readonly addUserNameInput: Locator;
  public readonly addUserRoleSelect: Locator;
  public readonly addUserProductSelect: Locator;
  public readonly addUserCreateBtn: Locator;
  public readonly addUserError: Locator;

  public constructor(public readonly page: Page) {
    this.heading = page.locator('[data-testid="user-management-heading"]');
    this.table = page.locator('[data-testid="user-management-table"]');
    this.roleDialog = page.locator('[data-testid="user-role-dialog"]');
    this.roleSelect = page.locator('[data-testid="user-role-dialog-role-select"]');
    this.productSelect = page.locator('[data-testid="user-role-dialog-product-select"]');
    this.assignBtn = page.locator('[data-testid="user-role-dialog-assign-btn"]');

    this.addUserBtn = page.locator('[data-testid="user-management-add-user-btn"]');
    this.addUserDialog = page.locator('[data-testid="add-user-dialog"]');
    this.addUserEmailInput = page.locator('[data-testid="add-user-email-input"]');
    this.addUserNameInput = page.locator('[data-testid="add-user-name-input"]');
    this.addUserRoleSelect = page.locator('[data-testid="add-user-role-select"]');
    this.addUserProductSelect = page.locator('[data-testid="add-user-product-select"]');
    this.addUserCreateBtn = page.locator('[data-testid="add-user-create-btn"]');
    this.addUserError = page.locator('[data-testid="add-user-error"]');
  }

  public async goto() {
    await this.page.goto('/admin/users');
  }

  public getRows(): Locator {
    return this.table.locator('tbody tr');
  }

  public async openManageRoles(userId: string) {
    await this.page.locator(`[data-testid="user-management-manage-roles-${userId}"]`).click();
  }

  public async openAddUserDialog() {
    await this.addUserBtn.click();
  }

  public async selectOption(selectLocator: Locator, optionLabel: string) {
    await selectLocator.locator('button[role="combobox"]').click();
    await selectLocator.locator(`button[role="option"]`, { hasText: optionLabel }).click();
  }
}
