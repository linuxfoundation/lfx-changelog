// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect } from '@playwright/test';

import type { Locator, Page } from '@playwright/test';

/**
 * Reusable helpers for asserting toast notifications in e2e tests.
 *
 * Usage:
 *   await expectToast(page, 'Entry published!');
 *   await expectToast(page, 'Entry saved', 'success');
 *   await expectNoToast(page);
 */

/** Locate all visible toasts on the page. */
export function getToasts(page: Page): Locator {
  return page.locator('[data-testid="toast"]');
}

/** Assert that a toast with the given message (substring match) appears within the timeout. */
export async function expectToast(page: Page, message: string, type?: 'success' | 'error' | 'warning' | 'info'): Promise<void> {
  const selector = type ? `[data-testid="toast"][data-toast-type="${type}"]` : '[data-testid="toast"]';
  const toast = page.locator(selector).filter({ has: page.locator(`[data-testid="toast-message"]:has-text("${message}")`) });

  await expect(toast.first()).toBeVisible({ timeout: 10_000 });
}

/** Assert that no toasts are currently visible. */
export async function expectNoToast(page: Page): Promise<void> {
  await expect(getToasts(page)).toHaveCount(0);
}

/** Dismiss the first visible toast and wait for it to disappear. */
export async function dismissToast(page: Page): Promise<void> {
  const dismissBtn = page.locator('[data-testid="toast-dismiss"]').first();
  await dismissBtn.click();
}
