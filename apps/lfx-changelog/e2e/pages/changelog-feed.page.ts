// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { Locator, Page } from '@playwright/test';

export class ChangelogFeedPage {
  public readonly heading: Locator;
  public readonly loading: Locator;
  public readonly empty: Locator;
  public readonly timeline: Locator;
  public readonly searchInput: Locator;
  public readonly searchClear: Locator;
  public readonly searchResults: Locator;
  public readonly searchCount: Locator;
  public readonly searchEmpty: Locator;

  public constructor(public readonly page: Page) {
    this.heading = page.locator('[data-testid="changelog-feed-heading"]');
    this.loading = page.locator('[data-testid="changelog-feed-loading"]');
    this.empty = page.locator('[data-testid="changelog-feed-empty"]');
    this.timeline = page.locator('[data-testid="changelog-feed-timeline"]');
    this.searchInput = page.locator('[data-testid="changelog-feed-search-input"]');
    this.searchClear = page.locator('[data-testid="changelog-feed-search-clear"]');
    this.searchResults = page.locator('[data-testid="changelog-feed-search-results"]');
    this.searchCount = page.locator('[data-testid="changelog-feed-search-count"]');
    this.searchEmpty = page.locator('[data-testid="changelog-feed-search-empty"]');
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

  public async search(query: string) {
    await this.searchInput.fill(query);
  }

  public async clearSearch() {
    await this.searchClear.click();
  }
}
