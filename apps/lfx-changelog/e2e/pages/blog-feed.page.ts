// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { Locator, Page } from '@playwright/test';

export class BlogFeedPage {
  public readonly heading: Locator;
  public readonly posts: Locator;
  public readonly loading: Locator;
  public readonly empty: Locator;

  public constructor(public readonly page: Page) {
    this.heading = page.locator('[data-testid="blog-feed-heading"]');
    this.posts = page.locator('[data-testid="blog-feed-posts"]');
    this.loading = page.locator('[data-testid="blog-feed-loading"]');
    this.empty = page.locator('[data-testid="blog-feed-empty"]');
  }

  public async goto() {
    await this.page.goto('/blog', { waitUntil: 'networkidle' });
  }

  public getPostCards(): Locator {
    return this.page.locator('[data-testid="blog-feed-post-title"]');
  }
}
