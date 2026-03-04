// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { Locator, Page } from '@playwright/test';

export class UserSettingsPage {
  public readonly heading: Locator;
  public readonly integrationsHeading: Locator;
  public readonly connectSlackBtn: Locator;
  public readonly sidebarLink: Locator;

  public constructor(public readonly page: Page) {
    this.heading = page.locator('[data-testid="user-settings-heading"]');
    this.integrationsHeading = page.locator('[data-testid="user-settings-integrations-heading"]');
    this.connectSlackBtn = page.locator('[data-testid="user-settings-connect-slack-btn"]');
    this.sidebarLink = page.locator('[data-testid="admin-sidebar-settings"]');
  }

  public async goto() {
    await this.page.goto('/admin/settings');
  }
}
