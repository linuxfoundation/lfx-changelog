// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { Locator, Page } from '@playwright/test';

export class ChangelogFeedPage {
  public readonly heading: Locator;
  public readonly loading: Locator;
  public readonly empty: Locator;
  public readonly timeline: Locator;

  public constructor(public readonly page: Page) {
    this.heading = page.locator('[data-testid="changelog-feed-heading"]');
    this.loading = page.locator('[data-testid="changelog-feed-loading"]');
    this.empty = page.locator('[data-testid="changelog-feed-empty"]');
    this.timeline = page.locator('[data-testid="changelog-feed-timeline"]');
  }

  public async goto() {
    await this.page.goto('/');
  }

  public getFilterChip(productId: string): Locator {
    return this.page.locator(`[data-testid="changelog-feed-filter-chip-${productId}"]`);
  }

  public async clickProductFilter(productId: string) {
    await this.getFilterChip(productId).click();
  }

  public getEntryCards(): Locator {
    return this.page.locator('[data-testid^="changelog-card-"]');
  }

  public getEntryCard(entryId: string): Locator {
    return this.page.locator(`[data-testid="changelog-card-${entryId}"]`);
  }

  public async clickEntry(entryId: string) {
    await this.getEntryCard(entryId).locator('a').click();
  }
}
