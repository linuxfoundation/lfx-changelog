// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { Locator, Page } from '@playwright/test';

export class ReleaseListPage {
  public readonly heading: Locator;
  public readonly emptyState: Locator;
  public readonly table: Locator;
  public readonly historyTable: Locator;

  public constructor(public readonly page: Page) {
    this.heading = page.locator('[data-testid="release-list-heading"]');
    this.emptyState = page.locator('[data-testid="release-list-empty"]');
    this.table = page.locator('[data-testid="release-list-table"]');
    this.historyTable = page.locator('[data-testid="release-history-table"]');
  }

  public async goto() {
    await this.page.goto('/admin/release-jobs');
  }

  public getRow(serviceKey: string): Locator {
    return this.page.locator(`[data-testid="release-list-row-${serviceKey}"]`);
  }

  public getStartButton(serviceKey: string): Locator {
    return this.page.locator(`[data-testid="release-list-start-${serviceKey}"]`);
  }

  public async startRelease(serviceKey: string) {
    await this.getStartButton(serviceKey).click();
  }
}
