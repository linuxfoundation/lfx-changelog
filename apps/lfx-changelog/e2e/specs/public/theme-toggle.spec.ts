// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { PublicLayoutPage } from '../../pages/public-layout.page.js';

test.describe('Theme Toggle', () => {
  let layoutPage: PublicLayoutPage;

  test.beforeEach(async ({ page }) => {
    layoutPage = new PublicLayoutPage(page);
    await layoutPage.goto();
  });

  test('should default to light mode', async () => {
    await layoutPage.expectLightMode();
  });

  test('should toggle to dark mode', async () => {
    await layoutPage.toggleTheme();
    await layoutPage.expectDarkMode();
  });

  test('should toggle back to light mode', async () => {
    await layoutPage.toggleTheme();
    await layoutPage.expectDarkMode();

    await layoutPage.toggleTheme();
    await layoutPage.expectLightMode();
  });

  test('should persist theme across page reload', async ({ page }) => {
    await layoutPage.toggleTheme();
    await layoutPage.expectDarkMode();

    await page.reload();
    await layoutPage.expectDarkMode();
  });

  test('should show theme toggle button', async () => {
    await expect(layoutPage.themeToggle).toBeVisible();
  });
});
