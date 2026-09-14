// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { Locator, Page } from '@playwright/test';

export class ContributorsPage {
  public readonly heading: Locator;
  public readonly table: Locator;
  public readonly syncBtn: Locator;
  public readonly searchInput: Locator;
  public readonly productFilter: Locator;
  public readonly slackFilter: Locator;

  // Link to Slack dialog
  public readonly linkDialog: Locator;
  public readonly linkLoading: Locator;
  public readonly linkUserSelect: Locator;
  public readonly linkSaveBtn: Locator;
  public readonly linkError: Locator;

  // Shared confirm dialog (no testId passed, so it falls back to dialog-box)
  public readonly confirmDialog: Locator;

  public constructor(public readonly page: Page) {
    this.heading = page.locator('[data-testid="contributors-heading"]');
    this.table = page.locator('[data-testid="contributors-table"]');
    this.syncBtn = page.locator('[data-testid="contributors-sync-btn"]');
    this.searchInput = page.locator('[data-testid="contributors-search-input"]');
    this.productFilter = page.locator('[data-testid="contributors-product-filter"]');
    this.slackFilter = page.locator('[data-testid="contributors-slack-filter"]');

    this.linkDialog = page.locator('[data-testid="link-slack-dialog"]');
    this.linkLoading = page.locator('[data-testid="link-slack-loading"]');
    this.linkUserSelect = page.locator('[data-testid="link-slack-user-select"]');
    this.linkSaveBtn = page.locator('[data-testid="link-slack-save-btn"]');
    this.linkError = page.locator('[data-testid="link-slack-error"]');

    this.confirmDialog = page.locator('[data-testid="dialog-box"]');
  }

  public async goto() {
    // networkidle so hydration has wired the filter FormControls before a spec types into them —
    // a fill() that lands pre-hydration updates the DOM but never reaches valueChanges.
    await this.page.goto('/admin/contributors', { waitUntil: 'networkidle' });
  }

  public getRows(): Locator {
    return this.table.locator('tbody tr');
  }

  public getRowByLogin(githubLogin: string): Locator {
    return this.getRows().filter({ hasText: githubLogin });
  }

  public async search(term: string) {
    await this.searchInput.locator('input').fill(term);
  }

  public async openLinkDialogFor(githubLogin: string) {
    await this.getRowByLogin(githubLogin).getByRole('button', { name: 'Link Slack' }).click();
  }

  public async openUnlinkDialogFor(githubLogin: string) {
    await this.getRowByLogin(githubLogin).getByRole('button', { name: 'Unlink' }).click();
  }

  public async confirmUnlink() {
    await this.confirmDialog.getByRole('button', { name: 'Unlink' }).click();
  }

  public async selectOption(selectLocator: Locator, optionLabel: string) {
    await selectLocator.locator('button[role="combobox"]').click();
    await selectLocator.locator(`button[role="option"]`, { hasText: optionLabel }).click();
  }
}
