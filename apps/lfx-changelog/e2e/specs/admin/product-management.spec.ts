// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { ProductManagementPage } from '../../pages/product-management.page.js';

test.describe('Product Management', () => {
  let productPage: ProductManagementPage;

  test.beforeEach(async ({ page }) => {
    productPage = new ProductManagementPage(page);
    await productPage.goto();
  });

  test('should display heading', async () => {
    await expect(productPage.heading).toBeVisible();
    await expect(productPage.heading).toContainText('Products');
  });

  test('should display the product table', async () => {
    await expect(productPage.table).toBeVisible();
    const rows = productPage.getRows();
    await expect(rows.first()).toBeVisible();
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display add product button', async () => {
    await expect(productPage.addBtn).toBeVisible();
  });

  test('should open add product dialog', async () => {
    await productPage.openAddDialog();
    await expect(productPage.dialogNameInput).toBeVisible();
    await expect(productPage.dialogSlugInput).toBeVisible();
    await expect(productPage.dialogDescriptionInput).toBeVisible();
    await expect(productPage.dialogSaveBtn).toBeVisible();
  });

  test('should display product names in table', async () => {
    const rows = productPage.getRows();
    await expect(rows.first()).toBeVisible();
    const firstRowText = await rows.first().textContent();
    expect(firstRowText?.length).toBeGreaterThan(0);
  });

  test('should display product slugs in table', async () => {
    const rows = productPage.getRows();
    await expect(rows.first()).toBeVisible();
    const slug = rows.first().locator('td').nth(1);
    const slugText = await slug.textContent();
    expect(slugText?.trim().length).toBeGreaterThan(0);
  });

  test('should navigate to product detail on name click', async ({ page }) => {
    const rows = productPage.getRows();
    await expect(rows.first()).toBeVisible();
    const nameLink = rows.first().locator('a').first();
    await nameLink.click();
    await page.waitForURL(/\/admin\/products\//);
  });

  test('should display product icons in table', async () => {
    const rows = productPage.getRows();
    await expect(rows.first()).toBeVisible();
    const icon = rows.first().locator('i[class*="fa-duotone"]');
    await expect(icon).toBeVisible();
  });

  test('should close dialog with cancel', async ({ page }) => {
    await productPage.openAddDialog();
    await expect(productPage.dialogNameInput).toBeVisible();

    const cancelBtn = page.locator('[data-testid="dialog-close-btn"]');
    await cancelBtn.click();
    await expect(productPage.dialogNameInput).not.toBeVisible();
  });
});
