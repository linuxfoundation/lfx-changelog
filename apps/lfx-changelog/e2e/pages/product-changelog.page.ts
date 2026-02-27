// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { Locator, Page } from '@playwright/test';

export class ProductChangelogPage {
  public readonly heading: Locator;
  public readonly description: Locator;
  public readonly icon: Locator;
  public readonly backLink: Locator;
  public readonly timeline: Locator;
  public readonly empty: Locator;
  public readonly notFound: Locator;

  public constructor(public readonly page: Page) {
    this.heading = page.locator('[data-testid="product-changelog-heading"]');
    this.description = page.locator('[data-testid="product-changelog-description"]');
    this.icon = page.locator('[data-testid="product-changelog-icon"]');
    this.backLink = page.locator('[data-testid="product-changelog-back-link"]');
    this.timeline = page.locator('[data-testid="product-changelog-timeline"]');
    this.empty = page.locator('[data-testid="product-changelog-empty"]');
    this.notFound = page.locator('[data-testid="product-changelog-not-found"]');
  }

  public async goto(slug: string) {
    await this.page.goto(`/products/${slug}`);
  }

  public async getProductName(): Promise<string> {
    return (await this.heading.textContent()) ?? '';
  }

  public getEntries(): Locator {
    return this.page.locator('[data-testid^="changelog-card-"]');
  }

  public async goBack() {
    await this.backLink.click();
  }
}
