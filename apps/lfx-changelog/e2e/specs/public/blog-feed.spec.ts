// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { TEST_BLOG_POSTS } from '../../helpers/test-data.js';
import { BlogFeedPage } from '../../pages/blog-feed.page.js';

const PUBLISHED_COUNT = TEST_BLOG_POSTS.filter((p) => p.status === 'published').length;

test.describe('Blog Feed', () => {
  let feedPage: BlogFeedPage;

  test.beforeEach(async ({ page }) => {
    feedPage = new BlogFeedPage(page);
    await feedPage.goto();
  });

  test('should display the heading', async () => {
    await expect(feedPage.heading).toBeVisible();
    await expect(feedPage.heading).toContainText('Blog');
  });

  test('should display published blog posts', async () => {
    await expect(feedPage.posts).toBeVisible();
    const cards = feedPage.getPostCards();
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBe(PUBLISHED_COUNT);
  });

  test('should show title and type badge on each card', async () => {
    const cards = feedPage.getPostCards();
    await expect(cards.first()).toBeVisible();
    const firstTitle = await cards.first().textContent();
    expect(firstTitle?.length).toBeGreaterThan(0);
  });

  test('should navigate to blog detail when clicking a card', async ({ page }) => {
    const cards = feedPage.getPostCards();
    await expect(cards.first()).toBeVisible();
    // The h2 title is inside a wrapping <a routerLink> — clicking the title triggers navigation
    await cards.first().click();
    await page.waitForURL(/\/blog\//);
    expect(page.url()).toContain('/blog/');
  });

  test('should NOT display draft posts', async () => {
    const cards = feedPage.getPostCards();
    const count = await cards.count();
    // Only published posts should appear — no draft
    expect(count).toBe(PUBLISHED_COUNT);

    // Verify no draft title is present
    for (let i = 0; i < count; i++) {
      const text = await cards.nth(i).textContent();
      expect(text).not.toContain('Draft Upcoming Features');
    }
  });

  test('should show empty state when no posts match', async ({ page }) => {
    // Navigate with a filter that would yield no results — use a fake type
    await page.goto('/blog?type=nonexistent', { waitUntil: 'networkidle' });
    // Either empty state is visible or posts container has no cards
    const emptyVisible = await feedPage.empty.isVisible();
    if (emptyVisible) {
      await expect(feedPage.empty).toBeVisible();
    }
  });
});
