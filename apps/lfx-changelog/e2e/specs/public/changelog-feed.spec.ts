// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { ChangelogFeedPage } from '../../pages/changelog-feed.page.js';
import { PublicLayoutPage } from '../../pages/public-layout.page.js';

test.describe('Changelog Feed', () => {
  let feedPage: ChangelogFeedPage;
  let layoutPage: PublicLayoutPage;

  test.beforeEach(async ({ page }) => {
    feedPage = new ChangelogFeedPage(page);
    layoutPage = new PublicLayoutPage(page);
    await feedPage.goto();
  });

  test('should display the heading', async () => {
    await expect(feedPage.heading).toBeVisible();
    await expect(feedPage.heading).toContainText("What's New");
  });

  test('should display the header with logo', async () => {
    await expect(layoutPage.header).toBeVisible();
    await expect(layoutPage.logo).toBeVisible();
  });

  test('should render product filter chips', async ({ page }) => {
    const chips = page.locator('[data-testid^="changelog-feed-filter-chip-"]');
    await expect(chips.first()).toBeVisible();
    const count = await chips.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display published changelog entries in the timeline', async () => {
    await expect(feedPage.timeline).toBeVisible();
    const cards = feedPage.getEntryCards();
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should filter entries by product when clicking a filter chip', async ({ page }) => {
    const chips = page.locator('[data-testid^="changelog-feed-filter-chip-"]');
    await expect(chips.first()).toBeVisible();

    const initialCount = await feedPage.getEntryCards().count();
    await chips.first().click();
    await page.waitForTimeout(500);

    const filteredCount = await feedPage.getEntryCards().count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test('should clear filter when clicking the same chip again', async ({ page }) => {
    const chips = page.locator('[data-testid^="changelog-feed-filter-chip-"]');
    await expect(chips.first()).toBeVisible();

    const initialCount = await feedPage.getEntryCards().count();
    await chips.first().click();
    await page.waitForTimeout(500);

    await chips.first().click();
    await page.waitForTimeout(500);

    const resetCount = await feedPage.getEntryCards().count();
    expect(resetCount).toBe(initialCount);
  });

  test('should navigate to entry detail when clicking a card', async ({ page }) => {
    const cards = feedPage.getEntryCards();
    await expect(cards.first()).toBeVisible();

    const firstCard = cards.first();
    await firstCard.locator('a').click();
    await page.waitForURL(/\/entry\//);
    expect(page.url()).toContain('/entry/');
  });

  test('should show login button when not authenticated', async () => {
    await expect(layoutPage.loginBtn).toBeVisible();
  });

  test('should display the footer', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('The Linux Foundation');
  });
});
