// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { Locator, Page } from '@playwright/test';

export class BlogEditorPage {
  public readonly heading: Locator;
  public readonly titleInput: Locator;
  public readonly slugInput: Locator;
  public readonly excerptInput: Locator;
  public readonly typeSelect: Locator;
  public readonly description: Locator;
  public readonly publishBtn: Locator;
  public readonly saveBtn: Locator;
  public readonly cancelBtn: Locator;
  public readonly unpublishBtn: Locator;
  public readonly deleteBtn: Locator;
  public readonly preview: Locator;
  public readonly previewDesktop: Locator;
  public readonly previewMobile: Locator;
  public readonly periodStart: Locator;
  public readonly periodEnd: Locator;

  public constructor(public readonly page: Page) {
    this.heading = page.locator('[data-testid="blog-editor-heading"]');
    this.titleInput = page.locator('[data-testid="blog-editor-title-input"]');
    this.slugInput = page.locator('[data-testid="blog-editor-slug-input"]');
    this.excerptInput = page.locator('[data-testid="blog-editor-excerpt-input"]');
    this.typeSelect = page.locator('[data-testid="blog-editor-type-select"]');
    this.description = page.locator('[data-testid="blog-editor-description"]');
    this.publishBtn = page.locator('[data-testid="blog-editor-publish-btn"]');
    this.saveBtn = page.locator('[data-testid="blog-editor-save-btn"]');
    this.cancelBtn = page.locator('[data-testid="blog-editor-cancel-btn"]');
    this.unpublishBtn = page.locator('[data-testid="blog-editor-unpublish-btn"]');
    this.deleteBtn = page.locator('[data-testid="blog-editor-delete-btn"]');
    this.preview = page.locator('[data-testid="blog-editor-preview"]');
    this.previewDesktop = page.locator('[data-testid="blog-editor-preview-desktop"]');
    this.previewMobile = page.locator('[data-testid="blog-editor-preview-mobile"]');
    this.periodStart = page.locator('[data-testid="blog-editor-period-start"]');
    this.periodEnd = page.locator('[data-testid="blog-editor-period-end"]');
  }

  public async gotoNew() {
    await this.page.goto('/admin/blog/new');
  }

  public async gotoEdit(id: string) {
    await this.page.goto(`/admin/blog/${id}/edit`);
  }

  public async fillForm(data: { title?: string; slug?: string; excerpt?: string; description?: string }) {
    if (data.title) {
      await this.titleInput.locator('input').fill(data.title);
    }
    if (data.slug) {
      await this.slugInput.locator('input').fill(data.slug);
    }
    if (data.excerpt) {
      await this.excerptInput.locator('input').fill(data.excerpt);
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
