// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { Locator, Page } from '@playwright/test';

export class BlogListPage {
  public readonly heading: Locator;
  public readonly newPostBtn: Locator;
  public readonly typeFilter: Locator;
  public readonly statusFilter: Locator;
  public readonly table: Locator;
  public readonly actionsBtn: Locator;

  public constructor(public readonly page: Page) {
    this.heading = page.locator('[data-testid="blog-list-heading"]');
    this.newPostBtn = page.locator('[data-testid="blog-list-new-post-btn"]');
    this.typeFilter = page.locator('[data-testid="blog-list-type-filter"]');
    this.statusFilter = page.locator('[data-testid="blog-list-status-filter"]');
    this.table = page.locator('[data-testid="blog-list-table"]');
    this.actionsBtn = page.locator('[data-testid="blog-list-actions-btn"]');
  }

  public async goto() {
    await this.page.goto('/admin/blog');
  }

  public getRows(): Locator {
    return this.table.locator('tbody tr');
  }
}
