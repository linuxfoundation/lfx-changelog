// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { AdminDashboardPage } from '../../pages/admin-dashboard.page.js';
import { AdminLayoutPage } from '../../pages/admin-layout.page.js';

test.describe('Admin Auth Flow — unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should redirect unauthenticated users away from admin', async ({ page }) => {
    await page.goto('/admin');
    // SSR guard redirects to public feed (can't redirect to Express /login during SSR)
    await page.waitForURL('/', { timeout: 10_000 });
    await expect(page.locator('[data-testid="changelog-feed-heading"]')).toBeVisible();
  });
});

test.describe('Admin Auth Flow', () => {
  test('should display admin dashboard after authentication', async ({ page }) => {
    const dashboardPage = new AdminDashboardPage(page);
    await dashboardPage.goto();
    await expect(dashboardPage.heading).toBeVisible();
    await expect(dashboardPage.heading).toContainText('Dashboard');
  });

  test('should display user info in sidebar', async ({ page }) => {
    const layout = new AdminLayoutPage(page);
    await page.goto('/admin');
    await expect(layout.userMenuBtn).toBeVisible();
  });

  test('should show user name in sidebar when expanded', async ({ page }) => {
    const layout = new AdminLayoutPage(page);
    await page.goto('/admin');
    await expect(layout.userName).toBeVisible();
  });

  test('should show user email in sidebar when expanded', async ({ page }) => {
    const layout = new AdminLayoutPage(page);
    await page.goto('/admin');
    await expect(layout.userEmail).toBeVisible();
  });

  test('should open user menu popup', async ({ page }) => {
    const layout = new AdminLayoutPage(page);
    await page.goto('/admin');
    await layout.openUserMenu();
    await expect(layout.userMenuPopup).toBeVisible();
    await expect(layout.logoutLink).toBeVisible();
    await expect(layout.viewPublicLink).toBeVisible();
  });

  test('should navigate to public site from user menu', async ({ page }) => {
    const layout = new AdminLayoutPage(page);
    await page.goto('/admin');
    await layout.openUserMenu();
    await expect(layout.userMenuPopup).toBeVisible();
    await expect(layout.viewPublicLink).toBeVisible();
    await layout.viewPublicLink.click({ force: true });
    await page.waitForURL('/');
  });
});
