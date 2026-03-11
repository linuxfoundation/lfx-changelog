// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { BlogEditorPage } from '../../pages/blog-editor.page.js';
import { BlogListPage } from '../../pages/blog-list.page.js';

test.describe('Blog Editor', () => {
  let editorPage: BlogEditorPage;

  test.beforeEach(async ({ page }) => {
    editorPage = new BlogEditorPage(page);
  });

  test('should display new blog post heading', async () => {
    await editorPage.gotoNew();
    await expect(editorPage.heading).toBeVisible();
    await expect(editorPage.heading).toContainText('New Blog Post');
  });

  test('should display edit blog post heading when editing', async ({ page }) => {
    const listPage = new BlogListPage(page);
    await listPage.goto();
    const rows = listPage.getRows();
    await expect(rows.first()).toBeVisible();
    await rows.first().locator('a').click();
    await page.waitForURL(/\/admin\/blog\/.*\/edit/);

    await expect(editorPage.heading).toBeVisible();
    await expect(editorPage.heading).toContainText('Edit Blog Post');
  });

  test('should display title input', async () => {
    await editorPage.gotoNew();
    await expect(editorPage.titleInput).toBeVisible();
  });

  test('should display slug input', async () => {
    await editorPage.gotoNew();
    await expect(editorPage.slugInput).toBeVisible();
  });

  test('should display excerpt input', async () => {
    await editorPage.gotoNew();
    await expect(editorPage.excerptInput).toBeVisible();
  });

  test('should display type select', async () => {
    await editorPage.gotoNew();
    await expect(editorPage.typeSelect).toBeVisible();
  });

  test('should display description editor', async () => {
    await editorPage.gotoNew();
    await expect(editorPage.description).toBeVisible();
  });

  test('should display period date fields', async () => {
    await editorPage.gotoNew();
    await expect(editorPage.periodStart).toBeVisible();
    await expect(editorPage.periodEnd).toBeVisible();
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

  test('should display desktop preview toggle as active by default', async () => {
    await editorPage.gotoNew();
    await expect(editorPage.previewDesktop).toBeVisible();
    await expect(editorPage.previewMobile).toBeVisible();
  });

  test('should navigate back on cancel', async ({ page }) => {
    await editorPage.gotoNew();
    await editorPage.cancel();
    await page.waitForURL(/\/admin\/blog$/);
  });

  test('should show save button with correct text for new post', async () => {
    await editorPage.gotoNew();
    await expect(editorPage.saveBtn).toContainText('Save as Draft');
  });

  test('should show save button with update text when editing', async ({ page }) => {
    const listPage = new BlogListPage(page);
    await listPage.goto();
    const rows = listPage.getRows();
    await expect(rows.first()).toBeVisible();
    await rows.first().locator('a').click();
    await page.waitForURL(/\/admin\/blog\/.*\/edit/);

    await expect(editorPage.saveBtn).toContainText('Update Post');
  });

  test('should show publish button for new post', async () => {
    await editorPage.gotoNew();
    await expect(editorPage.publishBtn).toBeVisible();
  });

  test('should show publish button for draft entries', async ({ page }) => {
    const listPage = new BlogListPage(page);
    await listPage.goto();

    const draftRow = listPage.getRows().filter({ has: page.locator('lfx-status-badge:has-text("Draft")') });
    await expect(draftRow.first()).toBeVisible();
    await draftRow.first().locator('a').click();
    await page.waitForURL(/\/admin\/blog\/.*\/edit/);

    await expect(editorPage.publishBtn).toBeVisible();
  });

  test('should show unpublish button for published entries', async ({ page }) => {
    const listPage = new BlogListPage(page);
    await listPage.goto();

    const publishedRow = listPage.getRows().filter({ has: page.locator('lfx-status-badge:has-text("Published")') });
    await expect(publishedRow.first()).toBeVisible();
    await publishedRow.first().locator('a').click();
    await page.waitForURL(/\/admin\/blog\/.*\/edit/);

    await expect(editorPage.unpublishBtn).toBeVisible();
    await expect(editorPage.unpublishBtn).toContainText('Unpublish');
  });

  test('should not show unpublish button for draft entries', async ({ page }) => {
    const listPage = new BlogListPage(page);
    await listPage.goto();

    const draftRow = listPage.getRows().filter({ has: page.locator('lfx-status-badge:has-text("Draft")') });
    await expect(draftRow.first()).toBeVisible();
    await draftRow.first().locator('a').click();
    await page.waitForURL(/\/admin\/blog\/.*\/edit/);

    await expect(editorPage.unpublishBtn).not.toBeVisible();
  });

  test('should show delete button when editing', async ({ page }) => {
    const listPage = new BlogListPage(page);
    await listPage.goto();
    const rows = listPage.getRows();
    await expect(rows.first()).toBeVisible();
    await rows.first().locator('a').click();
    await page.waitForURL(/\/admin\/blog\/.*\/edit/);

    await expect(editorPage.deleteBtn).toBeVisible();
    await expect(editorPage.deleteBtn).toContainText('Delete');
  });

  test('should not show delete button for new posts', async () => {
    await editorPage.gotoNew();
    await expect(editorPage.deleteBtn).not.toBeVisible();
  });

  test('should open confirm dialog when clicking delete', async ({ page }) => {
    const listPage = new BlogListPage(page);
    await listPage.goto();
    const rows = listPage.getRows();
    await expect(rows.first()).toBeVisible();
    await rows.first().locator('a').click();
    await page.waitForURL(/\/admin\/blog\/.*\/edit/);

    await editorPage.deleteBtn.click();
    const dialog = page.locator('[data-testid="dialog-box"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('permanently delete');
  });

  test('should open confirm dialog when clicking unpublish', async ({ page }) => {
    const listPage = new BlogListPage(page);
    await listPage.goto();

    const publishedRow = listPage.getRows().filter({ has: page.locator('lfx-status-badge:has-text("Published")') });
    await expect(publishedRow.first()).toBeVisible();
    await publishedRow.first().locator('a').click();
    await page.waitForURL(/\/admin\/blog\/.*\/edit/);

    await editorPage.unpublishBtn.click();
    const dialog = page.locator('[data-testid="dialog-box"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('revert');
  });

  test('should pre-populate form when editing existing entry', async ({ page }) => {
    const listPage = new BlogListPage(page);
    await listPage.goto();
    const rows = listPage.getRows();
    await expect(rows.first()).toBeVisible();
    await rows.first().locator('a').click();
    await page.waitForURL(/\/admin\/blog\/.*\/edit/);

    const titleInput = editorPage.titleInput.locator('input');
    await expect(titleInput).not.toHaveValue('');
  });
});
