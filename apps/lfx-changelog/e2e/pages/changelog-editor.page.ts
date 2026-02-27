// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { Locator, Page } from '@playwright/test';

export class ChangelogEditorPage {
  public readonly heading: Locator;
  public readonly productSelect: Locator;
  public readonly titleInput: Locator;
  public readonly versionInput: Locator;
  public readonly description: Locator;
  public readonly saveBtn: Locator;
  public readonly cancelBtn: Locator;
  public readonly aiPanel: Locator;
  public readonly preview: Locator;

  public constructor(public readonly page: Page) {
    this.heading = page.locator('[data-testid="changelog-editor-heading"]');
    this.productSelect = page.locator('[data-testid="changelog-editor-product-select"]');
    this.titleInput = page.locator('[data-testid="changelog-editor-title-input"]');
    this.versionInput = page.locator('[data-testid="changelog-editor-version-input"]');
    this.description = page.locator('[data-testid="changelog-editor-description"]');
    this.saveBtn = page.locator('[data-testid="changelog-editor-save-btn"]');
    this.cancelBtn = page.locator('[data-testid="changelog-editor-cancel-btn"]');
    this.aiPanel = page.locator('[data-testid="changelog-editor-ai-panel"]');
    this.preview = page.locator('[data-testid="changelog-editor-preview"]');
  }

  public async gotoNew() {
    await this.page.goto('/admin/changelogs/new');
  }

  public async gotoEdit(id: string) {
    await this.page.goto(`/admin/changelogs/${id}/edit`);
  }

  public async fillForm(data: { title?: string; version?: string; description?: string }) {
    if (data.title) {
      await this.titleInput.locator('input').fill(data.title);
    }
    if (data.version) {
      await this.versionInput.locator('input').fill(data.version);
    }
    if (data.description) {
      await this.description.locator('textarea').fill(data.description);
    }
  }

  public async save() {
    await this.saveBtn.click();
  }

  public async cancel() {
    await this.cancelBtn.click();
  }
}
