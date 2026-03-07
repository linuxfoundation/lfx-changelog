// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { activateProduct, deactivateProduct } from '../../helpers/db.helper.js';
import { TEST_PRODUCTS } from '../../helpers/test-data.js';
import { ChangelogEditorPage } from '../../pages/changelog-editor.page.js';
import { ChangelogListPage } from '../../pages/changelog-list.page.js';

test.describe('Changelog Editor', () => {
  let editorPage: ChangelogEditorPage;

  test.beforeEach(async ({ page }) => {
    editorPage = new ChangelogEditorPage(page);
  });

  test('should display new entry heading', async () => {
    await editorPage.gotoNew();
    await expect(editorPage.heading).toBeVisible();
    await expect(editorPage.heading).toContainText('New Entry');
  });

  test('should display edit entry heading when editing', async ({ page }) => {
    const listPage = new ChangelogListPage(page);
    await listPage.goto();
    const rows = listPage.getRows();
    await expect(rows.first()).toBeVisible();
    await rows.first().locator('a').click();
    await page.waitForURL(/\/admin\/changelogs\/.*\/edit/);

    await expect(editorPage.heading).toBeVisible();
    await expect(editorPage.heading).toContainText('Edit Entry');
  });

  test('should display product select', async () => {
    await editorPage.gotoNew();
    await expect(editorPage.productSelect).toBeVisible();
  });

  test('should display title input', async () => {
    await editorPage.gotoNew();
    await expect(editorPage.titleInput).toBeVisible();
  });

  test('should display version input', async () => {
    await editorPage.gotoNew();
    await expect(editorPage.versionInput).toBeVisible();
  });

  test('should display description editor', async () => {
    await editorPage.gotoNew();
    await expect(editorPage.description).toBeVisible();
  });

  test('should display save and cancel buttons', async () => {
    await editorPage.gotoNew();
    await expect(editorPage.saveBtn).toBeVisible();
    await expect(editorPage.cancelBtn).toBeVisible();
  });

  test('should display live preview on desktop', async () => {
    await editorPage.gotoNew();
    await expect(editorPage.preview).toBeVisible();
  });

  test('should pre-populate form when editing', async ({ page }) => {
    const listPage = new ChangelogListPage(page);
    await listPage.goto();
    const rows = listPage.getRows();
    await expect(rows.first()).toBeVisible();
    await rows.first().locator('a').click();
    await page.waitForURL(/\/admin\/changelogs\/.*\/edit/);

    const titleInput = editorPage.titleInput.locator('input');
    await expect(titleInput).not.toHaveValue('');
  });

  test('should navigate back on cancel', async ({ page }) => {
    await editorPage.gotoNew();
    await editorPage.cancel();
    await page.waitForURL(/\/admin\/changelogs$/);
  });

  test('should show save button with correct text for new entry', async () => {
    await editorPage.gotoNew();
    await expect(editorPage.saveBtn).toContainText('Save as Draft');
  });

  test('should not show author section for new entries', async () => {
    await editorPage.gotoNew();
    await expect(editorPage.changeAuthorBtn).not.toBeVisible();
    await expect(editorPage.claimAuthorBtn).not.toBeVisible();
    await expect(editorPage.authorSelect).not.toBeVisible();
  });

  test('should show "Change" button for super admin when editing', async ({ page }) => {
    const listPage = new ChangelogListPage(page);
    await listPage.goto();
    const rows = listPage.getRows();
    await expect(rows.first()).toBeVisible();
    await rows.first().locator('a').click();
    await page.waitForURL(/\/admin\/changelogs\/.*\/edit/);

    await expect(editorPage.changeAuthorBtn).toBeVisible();
    await expect(editorPage.changeAuthorBtn).toContainText('Change');
  });

  test('should load author dropdown when "Change" button is clicked', async ({ page }) => {
    const listPage = new ChangelogListPage(page);
    await listPage.goto();
    const rows = listPage.getRows();
    await expect(rows.first()).toBeVisible();
    await rows.first().locator('a').click();
    await page.waitForURL(/\/admin\/changelogs\/.*\/edit/);

    await expect(editorPage.authorSelect).not.toBeVisible();
    await editorPage.changeAuthorBtn.click();
    await expect(editorPage.authorSelect).toBeVisible({ timeout: 10000 });
  });

  test('should show delete button when editing', async ({ page }) => {
    const listPage = new ChangelogListPage(page);
    await listPage.goto();
    const rows = listPage.getRows();
    await expect(rows.first()).toBeVisible();
    await rows.first().locator('a').click();
    await page.waitForURL(/\/admin\/changelogs\/.*\/edit/);

    await expect(editorPage.deleteBtn).toBeVisible();
    await expect(editorPage.deleteBtn).toContainText('Delete');
  });

  test('should not show delete button for new entries', async () => {
    await editorPage.gotoNew();
    await expect(editorPage.deleteBtn).not.toBeVisible();
  });

  test('should show unpublish button for published entries', async ({ page }) => {
    const listPage = new ChangelogListPage(page);
    await listPage.goto();

    // Find a published entry by locating a row with "Published" status badge
    const publishedRow = listPage.getRows().filter({ has: page.locator('lfx-status-badge:has-text("Published")') });
    await expect(publishedRow.first()).toBeVisible();
    await publishedRow.first().locator('a').click();
    await page.waitForURL(/\/admin\/changelogs\/.*\/edit/);

    await expect(editorPage.unpublishBtn).toBeVisible();
    await expect(editorPage.unpublishBtn).toContainText('Unpublish');
  });

  test('should not show unpublish button for draft entries', async ({ page }) => {
    const listPage = new ChangelogListPage(page);
    await listPage.goto();

    // Find a draft entry
    const draftRow = listPage.getRows().filter({ has: page.locator('lfx-status-badge:has-text("Draft")') });
    await expect(draftRow.first()).toBeVisible();
    await draftRow.first().locator('a').click();
    await page.waitForURL(/\/admin\/changelogs\/.*\/edit/);

    await expect(editorPage.unpublishBtn).not.toBeVisible();
  });

  test('should show publish button for draft entries', async ({ page }) => {
    const listPage = new ChangelogListPage(page);
    await listPage.goto();

    const draftRow = listPage.getRows().filter({ has: page.locator('lfx-status-badge:has-text("Draft")') });
    await expect(draftRow.first()).toBeVisible();
    await draftRow.first().locator('a').click();
    await page.waitForURL(/\/admin\/changelogs\/.*\/edit/);

    await expect(editorPage.publishBtn).toBeVisible();
  });

  test('should open confirm dialog when clicking delete', async ({ page }) => {
    const listPage = new ChangelogListPage(page);
    await listPage.goto();
    const rows = listPage.getRows();
    await expect(rows.first()).toBeVisible();
    await rows.first().locator('a').click();
    await page.waitForURL(/\/admin\/changelogs\/.*\/edit/);

    await editorPage.deleteBtn.click();
    // Confirm dialog should appear (rendered at app root via DialogService/dialog-outlet)
    const dialog = page.locator('[data-testid="dialog-box"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('permanently delete');
  });

  test('should open confirm dialog when clicking unpublish', async ({ page }) => {
    const listPage = new ChangelogListPage(page);
    await listPage.goto();

    const publishedRow = listPage.getRows().filter({ has: page.locator('lfx-status-badge:has-text("Published")') });
    await expect(publishedRow.first()).toBeVisible();
    await publishedRow.first().locator('a').click();
    await page.waitForURL(/\/admin\/changelogs\/.*\/edit/);

    await editorPage.unpublishBtn.click();
    const dialog = page.locator('[data-testid="dialog-box"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('revert');
  });

  test('should not show disabled product in product select dropdown', async () => {
    const targetProduct = TEST_PRODUCTS[1]!;
    await deactivateProduct(targetProduct.slug);
    try {
      await editorPage.gotoNew();
      await expect(editorPage.productSelect.locator('button[role="combobox"]')).toBeVisible();
      await editorPage.productSelect.locator('button[role="combobox"]').click();
      await editorPage.productSelect.locator('button[role="option"]').first().waitFor({ state: 'visible', timeout: 10_000 });

      const disabledOption = editorPage.productSelect.locator('button[role="option"]', { hasText: targetProduct.name });
      await expect(disabledOption).not.toBeVisible();

      const activeOption = editorPage.productSelect.locator('button[role="option"]', { hasText: TEST_PRODUCTS[0]!.name });
      await expect(activeOption).toBeVisible();
    } finally {
      await activateProduct(targetProduct.slug);
    }
  });
});
