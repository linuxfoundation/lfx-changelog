// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { UserSettingsPage } from '../../pages/user-settings.page.js';

test.describe('User Settings', () => {
  let settingsPage: UserSettingsPage;

  test.beforeEach(async ({ page }) => {
    settingsPage = new UserSettingsPage(page);
    await settingsPage.goto();
  });

  test('should display settings heading', async () => {
    await expect(settingsPage.heading).toBeVisible();
    await expect(settingsPage.heading).toContainText('Settings');
  });

  test('should display integrations section', async () => {
    await expect(settingsPage.integrationsHeading).toBeVisible();
    await expect(settingsPage.integrationsHeading).toContainText('Integrations');
  });

  test('should display Connect to Slack button when not connected', async () => {
    await expect(settingsPage.connectSlackBtn).toBeVisible();
    await expect(settingsPage.connectSlackBtn).toContainText('Connect to Slack');
  });

  test('should navigate to settings from sidebar', async ({ page }) => {
    await page.goto('/admin');
    settingsPage = new UserSettingsPage(page);
    await settingsPage.sidebarLink.click();
    await page.waitForURL(/\/admin\/settings/);
    await expect(settingsPage.heading).toBeVisible();
  });
});
