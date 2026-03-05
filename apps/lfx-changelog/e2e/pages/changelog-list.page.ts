// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { Locator, Page } from '@playwright/test';

export class ChangelogListPage {
  public readonly heading: Locator;
  public readonly newEntryBtn: Locator;
  public readonly productFilter: Locator;
  public readonly statusFilter: Locator;
  public readonly table: Locator;
  public readonly empty: Locator;
  public readonly resyncBtn: Locator;
  public readonly resyncResult: Locator;
  public readonly actionsBtn: Locator;

  public constructor(public readonly page: Page) {
    this.heading = page.locator('[data-testid="changelog-list-heading"]');
    this.newEntryBtn = page.locator('[data-testid="changelog-list-new-entry-btn"]');
    this.productFilter = page.locator('[data-testid="changelog-list-product-filter"]');
    this.statusFilter = page.locator('[data-testid="changelog-list-status-filter"]');
    this.table = page.locator('[data-testid="changelog-list-table"]');
    this.empty = page.locator('[data-testid="changelog-list-empty"]');
    this.resyncBtn = page.locator('[data-testid="changelog-list-resync-btn"]');
    this.resyncResult = page.locator('[data-testid="changelog-list-resync-result"]');
    this.actionsBtn = page.locator('[data-testid="changelog-list-actions-btn"]');
  }

  public async goto() {
    await this.page.goto('/admin/changelogs');
  }

  public getRows(): Locator {
    return this.table.locator('tbody tr');
  }
}
