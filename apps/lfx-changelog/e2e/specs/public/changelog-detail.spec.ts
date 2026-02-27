// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';

import { ChangelogDetailPage } from '../../pages/changelog-detail.page.js';
import { ChangelogFeedPage } from '../../pages/changelog-feed.page.js';

test.describe('Changelog Detail', () => {
  let detailPage: ChangelogDetailPage;

  test.beforeEach(async ({ page }) => {
    detailPage = new ChangelogDetailPage(page);
  });

  test('should navigate to detail from feed and display title', async ({ page }) => {
    const feedPage = new ChangelogFeedPage(page);
    await feedPage.goto();

    const firstCard = feedPage.getEntryCards().first();
    await expect(firstCard).toBeVisible();
    await firstCard.locator('a').click();
    await page.waitForURL(/\/entry\//);

    await expect(detailPage.title).toBeVisible();
    const title = await detailPage.getTitle();
    expect(title.length).toBeGreaterThan(0);
  });

  test('should display version when available', async ({ page }) => {
    const feedPage = new ChangelogFeedPage(page);
    await feedPage.goto();

    const firstCard = feedPage.getEntryCards().first();
    await firstCard.locator('a').click();
    await page.waitForURL(/\/entry\//);

    // Version may or may not be present depending on the entry
    const versionVisible = await detailPage.version.isVisible();
    if (versionVisible) {
      const version = await detailPage.getVersion();
      expect(version).toMatch(/v\d/);
    }
  });

  test('should display markdown content', async ({ page }) => {
    const feedPage = new ChangelogFeedPage(page);
    await feedPage.goto();

    const firstCard = feedPage.getEntryCards().first();
    await firstCard.locator('a').click();
    await page.waitForURL(/\/entry\//);

    await expect(detailPage.content).toBeVisible();
  });

  test('should display sidebar metadata', async ({ page }) => {
    const feedPage = new ChangelogFeedPage(page);
    await feedPage.goto();

    const firstCard = feedPage.getEntryCards().first();
    await firstCard.locator('a').click();
    await page.waitForURL(/\/entry\//);

    await expect(detailPage.product).toBeVisible();
    await expect(detailPage.publishedDate).toBeVisible();
    await expect(detailPage.author).toBeVisible();
  });

  test('should display back link and navigate to feed', async ({ page }) => {
    const feedPage = new ChangelogFeedPage(page);
    await feedPage.goto();

    const firstCard = feedPage.getEntryCards().first();
    await firstCard.locator('a').click();
    await page.waitForURL(/\/entry\//);

    await expect(detailPage.backLink).toBeVisible();
    await detailPage.goBack();
    await page.waitForURL('/');
  });

  test('should show not-found for invalid entry ID', async () => {
    await detailPage.goto('00000000-0000-0000-0000-000000000000');
    await expect(detailPage.notFound).toBeVisible();
  });

  test('should show not-found for non-UUID entry ID', async () => {
    await detailPage.goto('invalid-id');
    await expect(detailPage.notFound).toBeVisible();
  });

  test('should display published date in sidebar', async ({ page }) => {
    const feedPage = new ChangelogFeedPage(page);
    await feedPage.goto();

    const firstCard = feedPage.getEntryCards().first();
    await firstCard.locator('a').click();
    await page.waitForURL(/\/entry\//);

    await expect(detailPage.publishedDate).toBeVisible();
    const dateText = await detailPage.publishedDate.textContent();
    expect(dateText?.length).toBeGreaterThan(0);
  });
});
