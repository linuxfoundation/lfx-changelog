// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { Locator, Page } from '@playwright/test';

export class LinkRepositoriesDialogPage {
  public readonly dialog: Locator;
  public readonly orgSelect: Locator;
  public readonly nextBtn: Locator;
  public readonly backBtn: Locator;
  public readonly searchInput: Locator;
  public readonly searchClearBtn: Locator;
  public readonly selectedCount: Locator;
  public readonly list: Locator;
  public readonly noMatches: Locator;
  public readonly empty: Locator;
  public readonly submitBtn: Locator;
  public readonly closeBtn: Locator;
  public readonly addRepositoryBtn: Locator;

  public constructor(public readonly page: Page) {
    this.dialog = page.locator('[data-testid="link-repositories-dialog"]');
    this.orgSelect = page.locator('[data-testid="link-repos-org-select"]');
    this.nextBtn = page.locator('[data-testid="link-repos-next"]');
    this.backBtn = page.locator('[data-testid="link-repos-back"]');
    this.searchInput = page.locator('[data-testid="link-repos-search-input"]');
    this.searchClearBtn = page.locator('[data-testid="link-repos-search-clear"]');
    this.selectedCount = page.locator('[data-testid="link-repos-selected-count"]');
    this.list = page.locator('[data-testid="link-repos-list"]');
    this.noMatches = page.locator('[data-testid="link-repos-no-matches"]');
    this.empty = page.locator('[data-testid="link-repos-empty"]');
    this.submitBtn = page.locator('[data-testid="link-repos-submit"]');
    this.closeBtn = page.locator('[data-testid="dialog-close-btn"]');
    this.addRepositoryBtn = page.locator('[data-testid="product-repos-add-btn"]');
  }

  public async open(productId: string) {
    await this.page.goto(`/admin/products/${productId}`, { waitUntil: 'networkidle' });
    await this.page.locator('[data-testid="tab-repositories"]').click();
    await this.addRepositoryBtn.click();
  }

  public async chooseOrganization(login: string) {
    await this.orgSelect.locator('button[role="combobox"]').click();
    await this.orgSelect.locator('button[role="option"]', { hasText: login }).click();
  }

  public async next() {
    await this.nextBtn.click();
  }

  public async back() {
    await this.backBtn.click();
  }

  public async search(text: string) {
    await this.searchInput.fill(text);
  }

  public async clearSearch() {
    await this.searchClearBtn.click();
  }

  public item(fullName: string): Locator {
    return this.page.locator(`[data-testid="link-repos-item-${fullName}"]`);
  }

  public checkbox(fullName: string): Locator {
    return this.item(fullName).locator('input[type="checkbox"]');
  }

  public visibleItems(): Locator {
    return this.page.locator('[data-testid^="link-repos-item-"]');
  }
}
