// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
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
});
