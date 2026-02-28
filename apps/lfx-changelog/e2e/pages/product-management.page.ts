// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { Locator, Page } from '@playwright/test';

export class ProductManagementPage {
  public readonly heading: Locator;
  public readonly addBtn: Locator;
  public readonly table: Locator;
  public readonly dialog: Locator;
  public readonly dialogNameInput: Locator;
  public readonly dialogSlugInput: Locator;
  public readonly dialogDescriptionInput: Locator;
  public readonly dialogSaveBtn: Locator;

  public constructor(public readonly page: Page) {
    this.heading = page.locator('[data-testid="product-management-heading"]');
    this.addBtn = page.locator('[data-testid="product-management-add-btn"]');
    this.table = page.locator('[data-testid="product-management-table"]');
    this.dialog = page.locator('[data-testid="product-dialog"]');
    this.dialogNameInput = page.locator('[data-testid="product-dialog-name-input"]');
    this.dialogSlugInput = page.locator('[data-testid="product-dialog-slug-input"]');
    this.dialogDescriptionInput = page.locator('[data-testid="product-dialog-description-input"]');
    this.dialogSaveBtn = page.locator('[data-testid="product-dialog-save-btn"]');
  }

  public async goto() {
    await this.page.goto('/admin/products');
  }

  public getRows(): Locator {
    return this.table.locator('tbody tr');
  }

  public async openAddDialog() {
    await this.addBtn.click();
  }

  public async fillDialog(data: { name?: string; slug?: string; description?: string }) {
    if (data.name) {
      await this.dialogNameInput.locator('input').fill(data.name);
    }
    if (data.slug) {
      await this.dialogSlugInput.locator('input').fill(data.slug);
    }
    if (data.description) {
      await this.dialogDescriptionInput.locator('textarea').fill(data.description);
    }
  }

  public async saveDialog() {
    await this.dialogSaveBtn.click();
  }
}
