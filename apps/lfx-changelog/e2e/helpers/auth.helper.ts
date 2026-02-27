// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { Page } from '@playwright/test';

export async function loginViaAuth0(page: Page, email: string, password: string, returnTo = '/admin'): Promise<void> {
  // Navigate to login with returnTo
  await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`);

  // Wait for LF SSO login page (Auth0 custom domain)
  await page.waitForURL(/.*linuxfoundation.*/, { timeout: 15_000 });

  // Fill credentials on the LF SSO page
  await page.getByPlaceholder('Username or Email').fill(email);
  await page.getByPlaceholder('Password').fill(password);

  // Submit (button enables after fields are filled)
  await page.getByRole('button', { name: 'SIGN IN' }).click();

  // Wait for redirect back to app
  await page.waitForURL(`**${returnTo}*`, { timeout: 30_000 });
}

export async function expectAdminDashboard(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="admin-dashboard-heading"]', { timeout: 15_000 });
}

export async function logout(page: Page): Promise<void> {
  await page.goto('/logout');
  await page.waitForURL('**/', { timeout: 15_000 });
}
