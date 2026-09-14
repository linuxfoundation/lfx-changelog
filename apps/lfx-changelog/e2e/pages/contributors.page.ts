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
  public readonly linkUserSelect: Locator;
  public readonly linkSaveBtn: Locator;
  public readonly linkError: Locator;

  public constructor(public readonly page: Page) {
    this.heading = page.locator('[data-testid="contributors-heading"]');
    this.table = page.locator('[data-testid="contributors-table"]');
    this.syncBtn = page.locator('[data-testid="contributors-sync-btn"]');
    this.searchInput = page.locator('[data-testid="contributors-search-input"]');
    this.productFilter = page.locator('[data-testid="contributors-product-filter"]');
    this.slackFilter = page.locator('[data-testid="contributors-slack-filter"]');

    this.linkDialog = page.locator('[data-testid="link-slack-dialog"]');
    this.linkUserSelect = page.locator('[data-testid="link-slack-user-select"]');
    this.linkSaveBtn = page.locator('[data-testid="link-slack-save-btn"]');
    this.linkError = page.locator('[data-testid="link-slack-error"]');
  }

  public async goto() {
    await this.page.goto('/admin/contributors');
  }

  public getRows(): Locator {
    return this.table.locator('tbody tr');
  }

  public async openLinkDialog(contributorId: string) {
    await this.page.locator(`[data-testid="contributors-link-${contributorId}"]`).click();
  }

  public async openUnlinkDialog(contributorId: string) {
    await this.page.locator(`[data-testid="contributors-unlink-${contributorId}"]`).click();
  }

  public async selectOption(selectLocator: Locator, optionLabel: string) {
    await selectLocator.locator('button[role="combobox"]').click();
    await selectLocator.locator(`button[role="option"]`, { hasText: optionLabel }).click();
  }
}
