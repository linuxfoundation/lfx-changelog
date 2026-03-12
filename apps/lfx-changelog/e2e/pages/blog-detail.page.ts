// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { Locator, Page } from '@playwright/test';

export class BlogDetailPage {
  public readonly backLink: Locator;
  public readonly title: Locator;
  public readonly content: Locator;
  public readonly publishedDate: Locator;
  public readonly author: Locator;
  public readonly products: Locator;
  public readonly period: Locator;
  public readonly loading: Locator;
  public readonly notFound: Locator;

  public constructor(public readonly page: Page) {
    this.backLink = page.locator('[data-testid="blog-detail-back-link"]');
    this.title = page.locator('[data-testid="blog-detail-title"]');
    this.content = page.locator('[data-testid="blog-detail-content"]');
    this.publishedDate = page.locator('[data-testid="blog-detail-published-date"]');
    this.author = page.locator('[data-testid="blog-detail-author"]');
    this.products = page.locator('[data-testid="blog-detail-products"]');
    this.period = page.locator('[data-testid="blog-detail-period"]');
    this.loading = page.locator('[data-testid="blog-detail-loading"]');
    this.notFound = page.locator('[data-testid="blog-detail-not-found"]');
  }

  public async goto(slug: string) {
    await this.page.goto(`/blog/${slug}`);
  }

  public async getTitle(): Promise<string> {
    return (await this.title.textContent()) ?? '';
  }

  public async goBack() {
    await this.backLink.click();
  }
}
