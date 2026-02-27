// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { Locator, Page } from '@playwright/test';

export class AdminLayoutPage {
  public readonly sidebar: Locator;
  public readonly sidebarToggle: Locator;
  public readonly navDashboard: Locator;
  public readonly navChangelogs: Locator;
  public readonly navProducts: Locator;
  public readonly navUsers: Locator;
  public readonly userMenuBtn: Locator;
  public readonly userMenuPopup: Locator;
  public readonly userName: Locator;
  public readonly userEmail: Locator;
  public readonly themeToggle: Locator;
  public readonly viewPublicLink: Locator;
  public readonly logoutLink: Locator;

  public constructor(public readonly page: Page) {
    this.sidebar = page.locator('[data-testid="admin-layout-sidebar"]');
    this.sidebarToggle = page.locator('[data-testid="admin-sidebar-toggle"]');
    this.navDashboard = page.locator('[data-testid="admin-sidebar-dashboard"]');
    this.navChangelogs = page.locator('[data-testid="admin-sidebar-changelogs"]');
    this.navProducts = page.locator('[data-testid="admin-sidebar-products"]');
    this.navUsers = page.locator('[data-testid="admin-sidebar-users"]');
    this.userMenuBtn = page.locator('[data-testid="admin-user-menu-btn"]');
    this.userMenuPopup = page.locator('[data-testid="admin-user-menu-popup"]');
    this.userName = page.locator('[data-testid="admin-user-name"]');
    this.userEmail = page.locator('[data-testid="admin-user-email"]');
    this.themeToggle = page.locator('[data-testid="admin-theme-toggle"]');
    this.viewPublicLink = page.locator('[data-testid="admin-view-public-link"]');
    this.logoutLink = page.locator('[data-testid="admin-logout-link"]');
  }

  public async navigateToDashboard() {
    await this.navDashboard.click();
  }

  public async navigateToChangelogs() {
    await this.navChangelogs.click();
  }

  public async navigateToProducts() {
    await this.navProducts.click();
  }

  public async navigateToUsers() {
    await this.navUsers.click();
  }

  public async toggleSidebar() {
    await this.sidebarToggle.click();
  }

  public async openUserMenu() {
    await this.userMenuBtn.click();
  }

  public async logout() {
    await this.openUserMenu();
    await this.logoutLink.click();
  }
}
