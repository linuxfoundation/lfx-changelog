// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { Locator, Page } from '@playwright/test';

export class AdminDashboardPage {
  public readonly heading: Locator;
  public readonly newEntryBtn: Locator;
  public readonly allEntriesLink: Locator;
  public readonly statTotal: Locator;
  public readonly statPublished: Locator;
  public readonly statDrafts: Locator;
  public readonly statProducts: Locator;
  public readonly recentActivity: Locator;

  public constructor(public readonly page: Page) {
    this.heading = page.locator('[data-testid="admin-dashboard-heading"]');
    this.newEntryBtn = page.locator('[data-testid="admin-dashboard-new-entry-btn"]');
    this.allEntriesLink = page.locator('[data-testid="admin-dashboard-all-entries-link"]');
    this.statTotal = page.locator('[data-testid="admin-dashboard-stat-total"]');
    this.statPublished = page.locator('[data-testid="admin-dashboard-stat-published"]');
    this.statDrafts = page.locator('[data-testid="admin-dashboard-stat-drafts"]');
    this.statProducts = page.locator('[data-testid="admin-dashboard-stat-products"]');
    this.recentActivity = page.locator('[data-testid="admin-dashboard-recent-activity"]');
  }

  public async goto() {
    await this.page.goto('/admin');
  }

  public async getStatValue(stat: 'total' | 'published' | 'drafts' | 'products'): Promise<string> {
    const locatorMap = {
      total: this.statTotal,
      published: this.statPublished,
      drafts: this.statDrafts,
      products: this.statProducts,
    };
    const card = locatorMap[stat];
    const value = await card.locator('span.font-display').textContent();
    return value?.trim() ?? '';
  }

  public async clickNewEntry() {
    await this.newEntryBtn.click();
  }
}
