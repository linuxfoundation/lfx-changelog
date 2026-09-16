// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { activateProduct, deactivateProduct } from '../../helpers/db.helper.js';
import { TEST_PRODUCTS } from '../../helpers/test-data.js';
import { ProductDetailPage } from '../../pages/product-detail.page.js';
import { ProductManagementPage } from '../../pages/product-management.page.js';

test.describe('Product Detail', () => {
  let detailPage: ProductDetailPage;

  test.beforeEach(async ({ page }) => {
    detailPage = new ProductDetailPage(page);
  });

  test('should display product heading after navigating from list', async ({ page }) => {
    const mgmtPage = new ProductManagementPage(page);
    await mgmtPage.goto();
    const rows = mgmtPage.getRows();
    await expect(rows.first()).toBeVisible();
    await rows.first().locator('a').first().click();
    await page.waitForURL(/\/admin\/products\//);

    await expect(detailPage.heading).toBeVisible();
  });

  test('should display tabs', async ({ page }) => {
    const mgmtPage = new ProductManagementPage(page);
    await mgmtPage.goto();
    const rows = mgmtPage.getRows();
    await expect(rows.first()).toBeVisible();
    await rows.first().locator('a').first().click();
    await page.waitForURL(/\/admin\/products\//);

    await expect(detailPage.tabs).toBeVisible();
  });

  test('should switch between overview and repositories tabs', async ({ page }) => {
    const mgmtPage = new ProductManagementPage(page);
    await mgmtPage.goto();
    const rows = mgmtPage.getRows();
    await expect(rows.first()).toBeVisible();
    await rows.first().locator('a').first().click();
    await page.waitForURL(/\/admin\/products\//);

    const repoTab = page.locator('[data-testid="tab-repositories"]');
    await expect(repoTab).toBeVisible();
    await repoTab.click();

    const overviewTab = page.locator('[data-testid="tab-overview"]');
    await overviewTab.click();
  });

  test('should display back button', async ({ page }) => {
    const mgmtPage = new ProductManagementPage(page);
    await mgmtPage.goto();
    const rows = mgmtPage.getRows();
    await expect(rows.first()).toBeVisible();
    await rows.first().locator('a').first().click();
    await page.waitForURL(/\/admin\/products\//);

    await expect(detailPage.backBtn).toBeVisible();
  });

  test('should navigate back to product list', async ({ page }) => {
    const mgmtPage = new ProductManagementPage(page);
    await mgmtPage.goto();
    const rows = mgmtPage.getRows();
    await expect(rows.first()).toBeVisible();
    await rows.first().locator('a').first().click();
    await page.waitForURL(/\/admin\/products\//);

    await detailPage.goBack();
    await page.waitForURL(/\/admin\/products$/);
  });

  test('should display product icon', async ({ page }) => {
    const mgmtPage = new ProductManagementPage(page);
    await mgmtPage.goto();
    const rows = mgmtPage.getRows();
    await expect(rows.first()).toBeVisible();
    await rows.first().locator('a').first().click();
    await page.waitForURL(/\/admin\/products\//);

    const icon = page.locator('i[class*="fa-duotone"]').first();
    await expect(icon).toBeVisible();
  });

  test('should display Enabled badge for active product', async ({ page }) => {
    const mgmtPage = new ProductManagementPage(page);
    await mgmtPage.goto();
    const rows = mgmtPage.getRows();
    await expect(rows.first()).toBeVisible();
    await rows.first().locator('a').first().click();
    await page.waitForURL(/\/admin\/products\//);

    await expect(detailPage.statusBadge).toBeVisible();
    await expect(detailPage.statusBadge).toContainText('Enabled');
  });

  test('should display Disabled badge for inactive product', async ({ page }) => {
    const targetSlug = TEST_PRODUCTS[0]!.slug;
    await deactivateProduct(targetSlug);

    try {
      const mgmtPage = new ProductManagementPage(page);
      await mgmtPage.goto();
      const rows = mgmtPage.getRows();
      await expect(rows.first()).toBeVisible();
      await rows.first().locator('a').first().click();
      await page.waitForURL(/\/admin\/products\//);

      await expect(detailPage.statusBadge).toBeVisible();
      await expect(detailPage.statusBadge).toContainText('Disabled');
    } finally {
      await activateProduct(targetSlug);
    }
  });
});

test.describe('Product Detail — release history', () => {
  test('should open the release history from the product repositories tab', async ({ page }) => {
    const res = await page.request.get('/api/products');
    const products = (await res.json()).data as { id: string; slug: string }[];
    const easycla = products.find((product) => product.slug === 'e2e-easycla');
    expect(easycla, 'seeded product e2e-easycla is missing').toBeDefined();

    const detail = new ProductDetailPage(page);
    await detail.goto(easycla!.id);
    await detail.switchTab('repositories');

    const counts = page.locator('[data-testid^="product-repo-release-history-"]');
    await expect(counts.first()).toBeVisible();
    await counts.first().click();

    await expect(page.locator('[data-testid="release-history-dialog"]')).toBeVisible();

    const listed = page.locator('[data-testid="release-history-list"]');
    await expect(listed).toBeVisible({ timeout: 15000 });
    await expect(listed).toContainText('v1.1.0');
    await expect(listed).not.toContainText('v1.3.0-draft');
  });
});
