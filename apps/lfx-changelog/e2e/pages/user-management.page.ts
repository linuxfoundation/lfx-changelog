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

  public constructor(public readonly page: Page) {
    this.heading = page.locator('[data-testid="user-management-heading"]');
    this.table = page.locator('[data-testid="user-management-table"]');
    this.roleDialog = page.locator('[data-testid="user-role-dialog"]');
    this.roleSelect = page.locator('[data-testid="user-role-dialog-role-select"]');
    this.productSelect = page.locator('[data-testid="user-role-dialog-product-select"]');
    this.assignBtn = page.locator('[data-testid="user-role-dialog-assign-btn"]');
  }

  public async goto() {
    await this.page.goto('/admin/users');
  }

  public getRows(): Locator {
    return this.page.locator('[data-testid^="user-management-row-"]');
  }

  public async openManageRoles(userId: string) {
    await this.page.locator(`[data-testid="user-management-manage-roles-${userId}"]`).click();
  }
}
