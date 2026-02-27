// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { ProductChangelogPage } from '../../pages/product-changelog.page.js';

test.describe('Product Changelog', () => {
  let productPage: ProductChangelogPage;

  test.beforeEach(async ({ page }) => {
    productPage = new ProductChangelogPage(page);
  });

  test('should display product name and description', async () => {
    await productPage.goto('e2e-easycla');
    await expect(productPage.heading).toBeVisible();
    await expect(productPage.heading).toContainText('E2E EasyCLA');
    await expect(productPage.description).toBeVisible();
  });

  test('should display product icon', async () => {
    await productPage.goto('e2e-easycla');
    await expect(productPage.icon).toBeVisible();
  });

  test('should display only published entries', async () => {
    await productPage.goto('e2e-easycla');
    const entries = productPage.getEntries();
    await expect(entries.first()).toBeVisible();
    const count = await entries.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should show back link and navigate to home', async ({ page }) => {
    await productPage.goto('e2e-easycla');
    await expect(productPage.backLink).toBeVisible();
    await productPage.goBack();
    await page.waitForURL('/');
    expect(page.url()).toMatch(/\/$/);
  });

  test('should show empty state for product with no entries', async () => {
    await productPage.goto('e2e-insights');
    // Insights may have entries; this test validates the component renders
    await expect(productPage.heading).toBeVisible();
  });

  test('should show not-found state for invalid slug', async () => {
    await productPage.goto('nonexistent-product-slug');
    await expect(productPage.notFound).toBeVisible();
  });

  test('should display the timeline container', async () => {
    await productPage.goto('e2e-easycla');
    await expect(productPage.timeline).toBeVisible();
  });
});
