// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { activateProduct, deactivateProduct } from '../../helpers/db.helper.js';
import { TEST_PRODUCTS } from '../../helpers/test-data.js';
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

  test('should display Status column header', async () => {
    const headers = productPage.table.locator('thead th');
    await expect(headers.filter({ hasText: 'Status' })).toBeVisible();
  });

  test('should display status badges in table', async () => {
    const rows = productPage.getRows();
    await expect(rows.first()).toBeVisible();
    const badge = rows.first().locator('lfx-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('Enabled');
  });

  test('should show actions dropdown menu', async ({ page }) => {
    const rows = productPage.getRows();
    await expect(rows.first()).toBeVisible();
    await productPage.actionsBtn.first().click();

    // Dropdown panel is appended to document.body
    const dropdownPanel = page.locator('body > div').last();
    await expect(dropdownPanel.getByText('Edit')).toBeVisible();
    await expect(dropdownPanel.getByText('Disable')).toBeVisible();
    await expect(dropdownPanel.getByText('Delete')).toBeVisible();
  });

  test('should show Enable option for disabled products', async ({ page }) => {
    const targetSlug = TEST_PRODUCTS[0]!.slug;
    await deactivateProduct(targetSlug);

    try {
      await page.reload();
      const rows = productPage.getRows();
      await expect(rows.first()).toBeVisible();
      await productPage.actionsBtn.first().click();

      const dropdownPanel = page.locator('body > div').last();
      await expect(dropdownPanel.getByText('Enable')).toBeVisible();
    } finally {
      await activateProduct(targetSlug);
    }
  });

  test('should show confirm dialog when clicking Disable', async ({ page }) => {
    const rows = productPage.getRows();
    await expect(rows.first()).toBeVisible();
    await productPage.actionsBtn.first().click();

    const dropdownPanel = page.locator('body > div').last();
    await dropdownPanel.getByText('Disable').click();

    const dialog = page.locator('[data-testid="dialog-box"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-testid="dialog-title"]')).toContainText('Disable Product');
    await expect(dialog.locator('p')).toContainText('public changelog');
  });

  test('should disable product after confirming', async ({ page }) => {
    const targetSlug = TEST_PRODUCTS[0]!.slug;

    try {
      const rows = productPage.getRows();
      await expect(rows.first()).toBeVisible();
      await productPage.actionsBtn.first().click();

      const dropdownPanel = page.locator('body > div').last();
      await dropdownPanel.getByText('Disable').click();

      const dialog = page.locator('[data-testid="dialog-box"]');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Disable' }).click();

      // Badge should change to "Disabled"
      await expect(rows.first().locator('lfx-badge')).toContainText('Disabled');
    } finally {
      await activateProduct(targetSlug);
    }
  });
});
