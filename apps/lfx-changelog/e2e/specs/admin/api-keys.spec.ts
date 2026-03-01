// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { ApiKeysPage } from '../../pages/api-keys.page.js';

test.describe('API Keys', () => {
  let apiKeysPage: ApiKeysPage;

  test.beforeEach(async ({ page }) => {
    apiKeysPage = new ApiKeysPage(page);
    await apiKeysPage.goto();
  });

  test.describe('Page Load', () => {
    test('should display heading', async () => {
      await expect(apiKeysPage.heading).toBeVisible();
      await expect(apiKeysPage.heading).toContainText('API Keys');
    });

    test('should display create button', async () => {
      await expect(apiKeysPage.createBtn).toBeVisible();
    });
  });

  test.describe('Create Dialog', () => {
    test('should open create dialog', async () => {
      await apiKeysPage.openCreateDialog();
      await expect(apiKeysPage.createDialog).toBeVisible();
      await expect(apiKeysPage.nameInput).toBeVisible();
      await expect(apiKeysPage.scopeCheckboxes.first()).toBeVisible();
      await expect(apiKeysPage.createSubmitBtn).toBeVisible();
    });

    test('should close create dialog with X button', async ({ page }) => {
      await apiKeysPage.openCreateDialog();
      await expect(apiKeysPage.createDialog).toBeVisible();

      const closeBtn = page.locator('[data-testid="dialog-close-btn"]');
      await closeBtn.click();
      await expect(apiKeysPage.createDialog).not.toBeVisible();
    });

    test('should display all four scope checkboxes', async () => {
      await apiKeysPage.openCreateDialog();
      await expect(apiKeysPage.scopeCheckboxes).toHaveCount(4);
    });
  });

  test.describe('Full Create → Display → Revoke Lifecycle', () => {
    test('should create a key, display it, and revoke it', async () => {
      const keyName = `E2E Test Key ${Date.now()}`;

      // Create
      await apiKeysPage.openCreateDialog();
      await apiKeysPage.fillName(keyName);
      await apiKeysPage.checkScope('changelogs:read');
      await apiKeysPage.submitCreate();

      // Verify created dialog with raw key
      await expect(apiKeysPage.createdDialog).toBeVisible();
      await expect(apiKeysPage.rawKeyValue).toBeVisible();
      const rawKey = await apiKeysPage.rawKeyValue.textContent();
      expect(rawKey).toMatch(/^lfx_/);

      // Close created dialog
      await apiKeysPage.closeCreatedDialog();
      await expect(apiKeysPage.createdDialog).not.toBeVisible();

      // Verify new key row appears
      const newRow = apiKeysPage.keyRows.filter({ hasText: keyName });
      await expect(newRow).toBeVisible();

      // Revoke
      const rowIndex = await apiKeysPage.keyRows.evaluateAll((rows, name) => rows.findIndex((r) => r.textContent?.includes(name)), keyName);
      await apiKeysPage.openRevokeForRow(rowIndex);
      await expect(apiKeysPage.revokeDialog).toBeVisible();
      await apiKeysPage.confirmRevoke();

      // Verify key is gone from active list
      await expect(newRow).not.toBeVisible();
    });
  });

  test.describe('Revoke Dialog', () => {
    test('should open and close revoke dialog without revoking', async ({ page }) => {
      const keyName = `E2E Revoke Cancel ${Date.now()}`;

      // Create a key first
      await apiKeysPage.openCreateDialog();
      await apiKeysPage.fillName(keyName);
      await apiKeysPage.checkScope('changelogs:read');
      await apiKeysPage.submitCreate();
      await expect(apiKeysPage.createdDialog).toBeVisible();
      await apiKeysPage.closeCreatedDialog();

      // Open revoke dialog
      const newRow = apiKeysPage.keyRows.filter({ hasText: keyName });
      await expect(newRow).toBeVisible();
      const rowIndex = await apiKeysPage.keyRows.evaluateAll((rows, name) => rows.findIndex((r) => r.textContent?.includes(name)), keyName);
      await apiKeysPage.openRevokeForRow(rowIndex);
      await expect(apiKeysPage.revokeDialog).toBeVisible();

      // Cancel — click the Cancel button inside the revoke dialog
      const cancelBtn = page.locator('[data-testid="api-key-revoke-dialog"]').locator('lfx-button', { hasText: 'Cancel' });
      await cancelBtn.click();
      await expect(apiKeysPage.revokeDialog).not.toBeVisible();

      // Key still in active list
      await expect(newRow).toBeVisible();
    });
  });

  test.describe('Inactive Keys Section', () => {
    test('should show inactive keys toggle after revoking', async () => {
      const keyName = `E2E Inactive ${Date.now()}`;

      // Create and revoke a key
      await apiKeysPage.openCreateDialog();
      await apiKeysPage.fillName(keyName);
      await apiKeysPage.checkScope('changelogs:read');
      await apiKeysPage.submitCreate();
      await expect(apiKeysPage.createdDialog).toBeVisible();
      await apiKeysPage.closeCreatedDialog();

      const rowIndex = await apiKeysPage.keyRows.evaluateAll((rows, name) => rows.findIndex((r) => r.textContent?.includes(name)), keyName);
      await apiKeysPage.openRevokeForRow(rowIndex);
      await apiKeysPage.confirmRevoke();

      // Verify inactive toggle appears
      await expect(apiKeysPage.showInactiveBtn).toBeVisible();
    });

    test('should expand and collapse inactive keys', async () => {
      const keyName = `E2E Toggle ${Date.now()}`;

      // Create and revoke a key
      await apiKeysPage.openCreateDialog();
      await apiKeysPage.fillName(keyName);
      await apiKeysPage.checkScope('changelogs:read');
      await apiKeysPage.submitCreate();
      await expect(apiKeysPage.createdDialog).toBeVisible();
      await apiKeysPage.closeCreatedDialog();

      const rowIndex = await apiKeysPage.keyRows.evaluateAll((rows, name) => rows.findIndex((r) => r.textContent?.includes(name)), keyName);
      await apiKeysPage.openRevokeForRow(rowIndex);
      await apiKeysPage.confirmRevoke();

      // Expand inactive keys
      await expect(apiKeysPage.showInactiveBtn).toBeVisible();
      await apiKeysPage.showInactiveBtn.click();

      // Verify the revoked key name is visible in the inactive section
      const inactiveText = apiKeysPage.page.locator('.line-through', { hasText: keyName });
      await expect(inactiveText).toBeVisible();

      // Collapse
      await apiKeysPage.showInactiveBtn.click();
      await expect(inactiveText).not.toBeVisible();
    });
  });
});
