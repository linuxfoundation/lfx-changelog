// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { TEST_CHANGELOGS } from '../../helpers/test-data.js';
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

    const initialCards = feedPage.getEntryCards();
    const initialCount = await initialCards.count();
    await chips.first().click();
    await expect(feedPage.getEntryCards()).not.toHaveCount(initialCount);

    const filteredCount = await feedPage.getEntryCards().count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test('should clear filter when clicking the same chip again', async ({ page }) => {
    const chips = page.locator('[data-testid^="changelog-feed-filter-chip-"]');
    await expect(chips.first()).toBeVisible();

    const initialCount = await feedPage.getEntryCards().count();
    await chips.first().click();
    await expect(feedPage.getEntryCards()).not.toHaveCount(initialCount);

    await chips.first().click();
    await expect(feedPage.getEntryCards()).toHaveCount(initialCount);
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
    await expect(footer.locator('lfx-footer')).toBeAttached();
  });

  test('should display the search input', async () => {
    await expect(feedPage.searchInput).toBeVisible();
    await expect(feedPage.searchInput).toHaveAttribute('placeholder', 'Search changelogs...');
  });

  test('should show search results when typing a query', async () => {
    await feedPage.search('CLA');
    await expect(feedPage.searchCount).toBeVisible({ timeout: 10_000 });
    await expect(feedPage.searchCount).toContainText('result');
    await expect(feedPage.searchResults).toBeVisible();
  });

  test('should show clear button when search has value', async () => {
    await feedPage.search('CLA');
    await expect(feedPage.searchClear).toBeVisible();
  });

  test('should clear search and return to timeline when clear is clicked', async () => {
    await feedPage.search('CLA');
    await expect(feedPage.searchResults).toBeVisible({ timeout: 10_000 });
    await feedPage.clearSearch();
    await expect(feedPage.searchInput).toHaveValue('');
    await expect(feedPage.timeline).toBeVisible();
  });

  test('should show empty state for non-matching search', async () => {
    await feedPage.search('xyznonexistent123');
    await expect(feedPage.searchEmpty).toBeVisible({ timeout: 10_000 });
    await expect(feedPage.searchEmpty).toContainText('No results found');
  });
});

test.describe('Changelog Feed — Pagination', () => {
  const PUBLISHED_COUNT = TEST_CHANGELOGS.filter((c) => c.status === 'published').length;
  const PAGE_SIZE = 20;
  const TOTAL_PAGES = Math.ceil(PUBLISHED_COUNT / PAGE_SIZE);
  const LAST_PAGE_SIZE = PUBLISHED_COUNT - PAGE_SIZE * (TOTAL_PAGES - 1);
  let feedPage: ChangelogFeedPage;

  test.beforeEach(async ({ page }) => {
    feedPage = new ChangelogFeedPage(page);
    await feedPage.goto();
  });

  test('should show pagination when multiple pages exist', async () => {
    await expect(feedPage.pagination).toBeVisible();
  });

  test('should display correct page info text', async () => {
    await expect(feedPage.paginationInfo).toContainText(`Showing 1 to ${PAGE_SIZE} of ${PUBLISHED_COUNT}`);
  });

  test('should disable previous button on first page', async () => {
    await expect(feedPage.paginationPrev).toBeDisabled();
  });

  test('should enable next button on first page', async () => {
    await expect(feedPage.paginationNext).toBeEnabled();
  });

  test('should navigate to next page when clicking next', async () => {
    await feedPage.paginationNext.click();
    const start = PAGE_SIZE + 1;
    const end = Math.min(PAGE_SIZE * 2, PUBLISHED_COUNT);
    await expect(feedPage.paginationInfo).toContainText(`Showing ${start} to ${end} of ${PUBLISHED_COUNT}`);
    await expect(feedPage.paginationPrev).toBeEnabled();
  });

  test('should disable next button on last page', async () => {
    await feedPage.getPaginationPage(TOTAL_PAGES).click();
    await expect(feedPage.paginationNext).toBeDisabled();
  });

  test('should navigate back with previous button', async () => {
    await feedPage.paginationNext.click();
    await expect(feedPage.paginationInfo).toContainText(`Showing ${PAGE_SIZE + 1}`);
    await feedPage.paginationPrev.click();
    await expect(feedPage.paginationInfo).toContainText(`Showing 1 to ${PAGE_SIZE} of ${PUBLISHED_COUNT}`);
  });

  test('should highlight active page number', async () => {
    const page1Btn = feedPage.getPaginationPage(1);
    await expect(page1Btn).toHaveAttribute('aria-current', 'page');

    await feedPage.paginationNext.click();
    const page2Btn = feedPage.getPaginationPage(2);
    await expect(page2Btn).toHaveAttribute('aria-current', 'page');
    await expect(page1Btn).not.toHaveAttribute('aria-current', 'page');
  });

  test('should navigate when clicking a page number directly', async () => {
    await feedPage.getPaginationPage(TOTAL_PAGES).click();
    const start = PAGE_SIZE * (TOTAL_PAGES - 1) + 1;
    await expect(feedPage.paginationInfo).toContainText(`Showing ${start} to ${PUBLISHED_COUNT} of ${PUBLISHED_COUNT}`);
  });

  test('should reset to page 1 when changing product filter', async ({ page }) => {
    await feedPage.paginationNext.click();
    const page2Count = await feedPage.getEntryCards().count();

    const chips = page.locator('[data-testid^="changelog-feed-filter-chip-"]');
    await chips.first().click();

    await expect(feedPage.getEntryCards().first()).toBeVisible();
    await expect(feedPage.getEntryCards()).not.toHaveCount(page2Count);
  });

  test('should render correct number of entry cards per page', async () => {
    const cards = feedPage.getEntryCards();
    await expect(cards).toHaveCount(PAGE_SIZE);

    await feedPage.getPaginationPage(TOTAL_PAGES).click();
    await expect(cards).toHaveCount(LAST_PAGE_SIZE);
  });
});
