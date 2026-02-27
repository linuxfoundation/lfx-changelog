// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
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
});
