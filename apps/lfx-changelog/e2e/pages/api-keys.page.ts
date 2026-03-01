// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { Locator, Page } from '@playwright/test';

export class ApiKeysPage {
  // Header
  public readonly heading: Locator;
  public readonly createBtn: Locator;

  // Key rows
  public readonly keyRows: Locator;
  public readonly showInactiveBtn: Locator;

  // Create Dialog
  public readonly createDialog: Locator;
  public readonly nameInput: Locator;
  public readonly scopeCheckboxes: Locator;
  public readonly expirationSelect: Locator;
  public readonly createSubmitBtn: Locator;

  // Key Created Dialog
  public readonly createdDialog: Locator;
  public readonly rawKeyValue: Locator;
  public readonly copyBtn: Locator;

  // Revoke Dialog
  public readonly revokeDialog: Locator;
  public readonly revokeConfirmBtn: Locator;

  public constructor(public readonly page: Page) {
    // Header
    this.heading = page.locator('[data-testid="api-keys-heading"]');
    this.createBtn = page.locator('[data-testid="api-keys-create-btn"]');

    // Key rows
    this.keyRows = page.locator('[data-testid="api-key-row"]');
    this.showInactiveBtn = page.locator('[data-testid="api-keys-show-inactive"]');

    // Create Dialog
    this.createDialog = page.locator('[data-testid="api-key-create-dialog"]');
    this.nameInput = page.locator('[data-testid="api-key-name-input"]');
    this.scopeCheckboxes = page.locator('[data-testid^="api-key-scope-"]');
    this.expirationSelect = page.locator('[data-testid="api-key-expiration-select"]');
    this.createSubmitBtn = page.locator('[data-testid="api-key-create-submit"]');

    // Key Created Dialog
    this.createdDialog = page.locator('[data-testid="api-key-created-dialog"]');
    this.rawKeyValue = page.locator('[data-testid="api-key-raw-value"]');
    this.copyBtn = page.locator('[data-testid="api-key-copy-btn"]');

    // Revoke Dialog
    this.revokeDialog = page.locator('[data-testid="api-key-revoke-dialog"]');
    this.revokeConfirmBtn = page.locator('[data-testid="api-key-revoke-confirm"]');
  }

  public async goto() {
    await this.page.goto('/admin/api-keys');
  }

  public async openCreateDialog() {
    await this.createBtn.click();
  }

  public async fillName(name: string) {
    await this.nameInput.locator('input').fill(name);
  }

  public async checkScope(scope: string) {
    await this.page.locator(`[data-testid="api-key-scope-${scope}"]`).check();
  }

  public async selectExpiration(label: string) {
    await this.expirationSelect.locator('button[role="combobox"]').click();
    await this.expirationSelect.locator('button[role="option"]', { hasText: label }).click();
  }

  public async submitCreate() {
    await this.createSubmitBtn.click();
  }

  public async closeCreatedDialog() {
    await this.createdDialog.locator('lfx-button', { hasText: 'Done' }).click();
  }

  public async openRevokeForRow(index: number) {
    await this.keyRows.nth(index).locator('[data-testid="api-key-revoke-btn"]').click();
  }

  public async confirmRevoke() {
    await this.revokeConfirmBtn.click();
  }
}
