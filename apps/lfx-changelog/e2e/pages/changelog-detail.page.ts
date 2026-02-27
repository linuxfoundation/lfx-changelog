// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { Locator, Page } from '@playwright/test';

export class ChangelogDetailPage {
  public readonly backLink: Locator;
  public readonly title: Locator;
  public readonly version: Locator;
  public readonly content: Locator;
  public readonly product: Locator;
  public readonly publishedDate: Locator;
  public readonly author: Locator;
  public readonly loading: Locator;
  public readonly notFound: Locator;

  public constructor(public readonly page: Page) {
    this.backLink = page.locator('[data-testid="changelog-detail-back-link"]');
    this.title = page.locator('[data-testid="changelog-detail-title"]');
    this.version = page.locator('[data-testid="changelog-detail-version"]');
    this.content = page.locator('[data-testid="changelog-detail-content"]');
    this.product = page.locator('[data-testid="changelog-detail-product"]');
    this.publishedDate = page.locator('[data-testid="changelog-detail-published-date"]');
    this.author = page.locator('[data-testid="changelog-detail-author"]');
    this.loading = page.locator('[data-testid="changelog-detail-loading"]');
    this.notFound = page.locator('[data-testid="changelog-detail-not-found"]');
  }

  public async goto(id: string) {
    await this.page.goto(`/entry/${id}`);
  }

  public async getTitle(): Promise<string> {
    return (await this.title.textContent()) ?? '';
  }

  public async getVersion(): Promise<string> {
    return (await this.version.textContent()) ?? '';
  }

  public async goBack() {
    await this.backLink.click();
  }
}
