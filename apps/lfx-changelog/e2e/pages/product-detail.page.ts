// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { Locator, Page } from '@playwright/test';

export class ProductDetailPage {
  public readonly backBtn: Locator;
  public readonly heading: Locator;
  public readonly tabs: Locator;

  public constructor(public readonly page: Page) {
    this.backBtn = page.locator('[data-testid="product-detail-back-btn"]');
    this.heading = page.locator('[data-testid="product-detail-heading"]');
    this.tabs = page.locator('[data-testid="product-detail-tabs"]');
  }

  public async goto(id: string) {
    await this.page.goto(`/admin/products/${id}`);
  }

  public async switchTab(tabValue: string) {
    await this.page.locator(`[data-testid="tab-${tabValue}"]`).click();
  }

  public async goBack() {
    await this.backBtn.click();
  }
}
