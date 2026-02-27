// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, type Locator, type Page } from '@playwright/test';

export class PublicLayoutPage {
  public readonly header: Locator;
  public readonly logo: Locator;
  public readonly allUpdatesLink: Locator;
  public readonly themeToggle: Locator;
  public readonly loginBtn: Locator;
  public readonly logoutBtn: Locator;
  public readonly adminBtn: Locator;

  public constructor(public readonly page: Page) {
    this.header = page.locator('[data-testid="public-layout-header"]');
    this.logo = page.locator('[data-testid="public-layout-logo"]');
    this.allUpdatesLink = page.locator('[data-testid="public-layout-all-updates-link"]');
    this.themeToggle = page.locator('[data-testid="public-layout-theme-toggle"]');
    this.loginBtn = page.locator('[data-testid="public-layout-login-btn"]');
    this.logoutBtn = page.locator('[data-testid="public-layout-logout-btn"]');
    this.adminBtn = page.locator('[data-testid="public-layout-admin-btn"]');
  }

  public async goto() {
    await this.page.goto('/');
  }

  public async toggleTheme() {
    await this.themeToggle.click();
  }

  public async expectDarkMode() {
    await expect(this.page.locator('html')).toHaveClass(/dark/);
  }

  public async expectLightMode() {
    await expect(this.page.locator('html')).not.toHaveClass(/dark/);
  }
}
