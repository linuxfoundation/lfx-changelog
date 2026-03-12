// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { activateProduct, cleanTestDatabase, deactivateProduct, disconnectTestDb, seedTestDatabase, seedTestOpenSearch } from '../../helpers/db.helper.js';
import { cleanTestOpenSearch } from '../../helpers/docker.helper.js';
import { TEST_PRODUCTS } from '../../helpers/test-data.js';
import { dismissToast, expectNoToast, expectToast } from '../../helpers/toast.helper.js';
import { ChangelogEditorPage } from '../../pages/changelog-editor.page.js';
import { ChangelogListPage } from '../../pages/changelog-list.page.js';
import { ProductManagementPage } from '../../pages/product-management.page.js';

test.describe('Toast Notifications', () => {
  // These tests mutate DB state (publish, unpublish, delete). Re-seed afterward
  // so API tests that run later find the expected seed data.
  test.afterAll(async () => {
    cleanTestOpenSearch();
    await cleanTestDatabase();
    await seedTestDatabase();
    await seedTestOpenSearch();
    await disconnectTestDb();
  });

  test.describe('Changelog Editor', () => {
    let editorPage: ChangelogEditorPage;

    test.beforeEach(async ({ page }) => {
      editorPage = new ChangelogEditorPage(page);
    });

    test('should show success toast when saving a draft entry', async ({ page }) => {
      const listPage = new ChangelogListPage(page);
      await listPage.goto();

      // Open the draft entry for editing
      const draftRow = listPage.getRows().filter({ has: page.locator('lfx-status-badge:has-text("Draft")') });
      await expect(draftRow.first()).toBeVisible();
      await draftRow.first().locator('a').click();
      await page.waitForURL(/\/admin\/changelogs\/.*\/edit/);

      // The draft entry may not have a slug — generate one if missing
      const slugInput = editorPage.page.locator('[data-testid="changelog-editor-slug-input"] input');
      const slugValue = await slugInput.inputValue();
      if (!slugValue) {
        const generateBtn = editorPage.page.locator('lfx-button:has-text("Generate")');
        await generateBtn.click();
        await expect(slugInput).not.toHaveValue('');
      }

      // Save the entry
      await editorPage.saveBtn.click();
      await page.waitForURL(/\/admin\/changelogs$/);

      await expectToast(page, 'Entry saved', 'success');
    });

    test('should show success toast and redirect to public view when publishing', async ({ page }) => {
      const listPage = new ChangelogListPage(page);
      await listPage.goto();

      // Open the draft entry
      const draftRow = listPage.getRows().filter({ has: page.locator('lfx-status-badge:has-text("Draft")') });
      await expect(draftRow.first()).toBeVisible();
      await draftRow.first().locator('a').click();
      await page.waitForURL(/\/admin\/changelogs\/.*\/edit/);

      // Wait for the form to populate (title input gets filled from API response)
      const titleInput = editorPage.titleInput.locator('input');
      await expect(titleInput).not.toHaveValue('');

      // Ensure slug is present — generate if missing (e.g. on first run before save test)
      const slugInput = editorPage.page.locator('[data-testid="changelog-editor-slug-input"] input');
      await expect(slugInput)
        .not.toHaveValue('', { timeout: 5_000 })
        .catch(async () => {
          const generateBtn = editorPage.page.locator('lfx-button:has-text("Generate")');
          await generateBtn.click();
          await expect(slugInput).not.toHaveValue('');
        });

      // Publish it
      await editorPage.publishBtn.click();

      // Should redirect to the public entry page
      await page.waitForURL(/\/entry\//);
      await expectToast(page, 'Entry published!', 'success');
    });

    test('should show success toast when unpublishing', async ({ page }) => {
      const listPage = new ChangelogListPage(page);
      await listPage.goto();

      // Find a published entry
      const publishedRow = listPage.getRows().filter({ has: page.locator('lfx-status-badge:has-text("Published")') });
      await expect(publishedRow.first()).toBeVisible();
      await publishedRow.first().locator('a').click();
      await page.waitForURL(/\/admin\/changelogs\/.*\/edit/);

      // Click unpublish → confirm in dialog
      await editorPage.unpublishBtn.click();
      const dialog = page.locator('[data-testid="dialog-box"]');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Unpublish' }).click();

      await page.waitForURL(/\/admin\/changelogs$/);
      await expectToast(page, 'Entry unpublished', 'success');
    });

    test('should show success toast when deleting', async ({ page }) => {
      const listPage = new ChangelogListPage(page);
      await listPage.goto();

      const rows = listPage.getRows();
      await expect(rows.first()).toBeVisible();
      const initialCount = await rows.count();

      // Open the last entry (least impact on other tests)
      await rows.last().locator('a').click();
      await page.waitForURL(/\/admin\/changelogs\/.*\/edit/);

      // Delete → confirm
      await editorPage.deleteBtn.click();
      const dialog = page.locator('[data-testid="dialog-box"]');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Delete' }).click();

      await page.waitForURL(/\/admin\/changelogs$/);
      await expectToast(page, 'Entry deleted', 'success');
    });
  });

  test.describe('Product Management', () => {
    let productPage: ProductManagementPage;

    test.beforeEach(async ({ page }) => {
      productPage = new ProductManagementPage(page);
      await productPage.goto();
    });

    test('should show success toast when disabling a product', async ({ page }) => {
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

        await expectToast(page, 'disabled', 'success');
      } finally {
        await activateProduct(targetSlug);
      }
    });

    test('should show success toast when enabling a product', async ({ page }) => {
      const targetSlug = TEST_PRODUCTS[0]!.slug;
      await deactivateProduct(targetSlug);

      try {
        await page.reload();
        const rows = productPage.getRows();
        await expect(rows.first()).toBeVisible();
        await productPage.actionsBtn.first().click();

        const dropdownPanel = page.locator('body > div').last();
        await dropdownPanel.getByText('Enable').click();

        await expectToast(page, 'enabled', 'success');
      } finally {
        await activateProduct(targetSlug);
      }
    });
  });

  test.describe('Toast Behavior', () => {
    test('should dismiss toast when clicking the close button', async ({ page }) => {
      // Trigger a toast via saving a draft entry
      const listPage = new ChangelogListPage(page);
      await listPage.goto();

      const draftRow = listPage.getRows().filter({ has: page.locator('lfx-status-badge:has-text("Draft")') });
      // If no draft is available (deleted by earlier test), edit any entry
      const targetRow = (await draftRow.count()) > 0 ? draftRow.first() : listPage.getRows().first();
      await expect(targetRow).toBeVisible();
      await targetRow.locator('a').click();
      await page.waitForURL(/\/admin\/changelogs\/.*\/edit/);

      const editorPage = new ChangelogEditorPage(page);

      // Wait for the form to populate (title input gets filled from API response)
      const titleInput = editorPage.titleInput.locator('input');
      await expect(titleInput).not.toHaveValue('');

      // Ensure slug is present — generate if missing (required to save)
      const slugInput = editorPage.page.locator('[data-testid="changelog-editor-slug-input"] input');
      await expect(slugInput)
        .not.toHaveValue('', { timeout: 5_000 })
        .catch(async () => {
          const generateBtn = editorPage.page.locator('lfx-button:has-text("Generate")');
          await generateBtn.click();
          await expect(slugInput).not.toHaveValue('');
        });

      await editorPage.saveBtn.click();
      await page.waitForURL(/\/admin\/changelogs$/);

      await expectToast(page, 'Entry saved');
      await dismissToast(page);
      await expectNoToast(page);
    });
  });
});
