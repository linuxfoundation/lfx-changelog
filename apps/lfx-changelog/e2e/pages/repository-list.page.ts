// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { Locator, Page } from '@playwright/test';

export class RepositoryListPage {
  public readonly heading: Locator;
  public readonly emptyState: Locator;
  public readonly groupsContainer: Locator;

  public constructor(public readonly page: Page) {
    this.heading = page.locator('[data-testid="repository-list-heading"]');
    this.emptyState = page.locator('[data-testid="repository-list-empty"]');
    this.groupsContainer = page.locator('[data-testid="repository-list-groups"]');
  }

  public async goto() {
    await this.page.goto('/admin/repositories');
  }

  public getGroups(): Locator {
    return this.page.locator('[data-testid^="repository-list-group-"]');
  }

  public getGroupByProductId(productId: string): Locator {
    return this.page.locator(`[data-testid="repository-list-group-${productId}"]`);
  }
}
