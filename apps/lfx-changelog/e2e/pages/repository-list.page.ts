// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { Locator, Page } from '@playwright/test';

export class RepositoryListPage {
  public readonly heading: Locator;
  public readonly emptyState: Locator;
  public readonly groupsContainer: Locator;
  public readonly releaseDialog: Locator;
  public readonly releaseDialogError: Locator;
  public readonly releaseDialogLoading: Locator;
  public readonly releaseTagInput: Locator;
  public readonly releaseNameInput: Locator;
  public readonly releaseSubmit: Locator;

  public constructor(public readonly page: Page) {
    this.heading = page.locator('[data-testid="repository-list-heading"]');
    this.emptyState = page.locator('[data-testid="repository-list-empty"]');
    this.groupsContainer = page.locator('[data-testid="repository-list-groups"]');
    this.releaseDialog = page.locator('[data-testid="create-release-dialog"]');
    this.releaseDialogError = page.locator('[data-testid="create-release-error"]');
    this.releaseDialogLoading = page.locator('[data-testid="create-release-loading"]');
    this.releaseTagInput = page.locator('[data-testid="create-release-tag-input"] input');
    this.releaseNameInput = page.locator('[data-testid="create-release-name-input"] input');
    this.releaseSubmit = page.locator('[data-testid="create-release-submit"] button');
  }

  public getReleaseButtons(): Locator {
    return this.page.locator('[data-testid^="repo-create-release-"]');
  }

  public async goto() {
    await this.page.goto('/admin/repositories', { waitUntil: 'networkidle' });
  }

  public getGroups(): Locator {
    return this.page.locator('[data-testid^="repository-list-group-"]');
  }

  public getGroupByProductId(productId: string): Locator {
    return this.page.locator(`[data-testid="repository-list-group-${productId}"]`);
  }
}
