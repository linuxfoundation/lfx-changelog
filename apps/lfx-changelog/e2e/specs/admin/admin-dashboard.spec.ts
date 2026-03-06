// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { activateProduct, deactivateProduct } from '../../helpers/db.helper.js';
import { TEST_PRODUCTS } from '../../helpers/test-data.js';
import { AdminDashboardPage } from '../../pages/admin-dashboard.page.js';
import { AdminLayoutPage } from '../../pages/admin-layout.page.js';

test.describe('Admin Dashboard', () => {
  let dashboardPage: AdminDashboardPage;
  let layoutPage: AdminLayoutPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new AdminDashboardPage(page);
    layoutPage = new AdminLayoutPage(page);
    await dashboardPage.goto();
  });

  test('should display dashboard heading', async () => {
    await expect(dashboardPage.heading).toBeVisible();
    await expect(dashboardPage.heading).toContainText('Dashboard');
  });

  test('should display total entries stat card', async () => {
    await expect(dashboardPage.statTotal).toBeVisible();
    const value = await dashboardPage.getStatValue('total');
    expect(Number(value)).toBeGreaterThanOrEqual(0);
  });

  test('should display published count stat card', async () => {
    await expect(dashboardPage.statPublished).toBeVisible();
    const value = await dashboardPage.getStatValue('published');
    expect(Number(value)).toBeGreaterThanOrEqual(0);
  });

  test('should display drafts count stat card', async () => {
    await expect(dashboardPage.statDrafts).toBeVisible();
    const value = await dashboardPage.getStatValue('drafts');
    expect(Number(value)).toBeGreaterThanOrEqual(0);
  });

  test('should display products count stat card', async () => {
    await expect(dashboardPage.statProducts).toBeVisible();
    const value = await dashboardPage.getStatValue('products');
    expect(Number(value)).toBeGreaterThan(0);
  });

  test('should display recent activity section', async () => {
    await expect(dashboardPage.recentActivity).toBeVisible();
  });

  test('should navigate to new entry form', async ({ page }) => {
    await dashboardPage.clickNewEntry();
    await page.waitForURL(/\/admin\/changelogs\/new/);
  });

  test('should navigate to changelogs list via All Entries', async ({ page }) => {
    await dashboardPage.allEntriesLink.click();
    await page.waitForURL(/\/admin\/changelogs$/);
  });

  test('should navigate via sidebar links', async ({ page }) => {
    await layoutPage.navigateToProducts();
    await page.waitForURL(/\/admin\/products/);

    await layoutPage.navigateToDashboard();
    await page.waitForURL(/\/admin$/);
  });

  test('should show Users link in sidebar for super admin', async () => {
    await expect(layoutPage.navUsers).toBeVisible();
  });

  test('should not count disabled products in products stat', async () => {
    const targetProduct = TEST_PRODUCTS[1]!;

    // Get count with all products active
    await expect(dashboardPage.statProducts).toBeVisible();
    const allActiveCount = Number(await dashboardPage.getStatValue('products'));

    await deactivateProduct(targetProduct.slug);
    try {
      // Reload to pick up the change
      await dashboardPage.goto();
      await expect(dashboardPage.statProducts).toBeVisible();
      const afterDisableCount = Number(await dashboardPage.getStatValue('products'));

      expect(afterDisableCount).toBe(allActiveCount - 1);
    } finally {
      await activateProduct(targetProduct.slug);
    }
  });
});
