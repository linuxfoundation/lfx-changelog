// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { RepositoryListPage } from '../../pages/repository-list.page.js';

import type { Page, Route } from '@playwright/test';

/**
 * The release endpoints are stubbed so the successful path can be exercised without GitHub
 * credentials and without publishing a real tag. Everything below the network boundary — the
 * dialog's prefilling, note handling and publish payload — is the real implementation.
 */
const TARGET = {
  repositoryId: 'repo-1',
  fullName: 'linuxfoundation/e2e-easycla-repo',
  defaultBranch: 'main',
  latestTag: 'v1.3.0',
  latestReleaseUrl: 'https://github.com/linuxfoundation/e2e-easycla-repo/releases/tag/v1.3.0',
  suggestedTag: 'v1.3.1',
  branches: [
    { name: 'main', commit: { sha: 'a'.repeat(40) } },
    { name: 'develop', commit: { sha: 'b'.repeat(40) } },
  ],
};

const CHANGES = {
  previousTag: 'v1.3.0',
  previousReleaseUrl: TARGET.latestReleaseUrl,
  totalCommits: 12,
  compareUrl: 'https://github.com/linuxfoundation/e2e-easycla-repo/compare/v1.3.0...main',
};

function json(route: Route, data: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
}

/** `notesDelayMs` lets a test publish while a preview is still in flight. */
async function stubReleaseApi(page: Page, options: { notesDelayMs?: number } = {}) {
  const created: { payload: unknown }[] = [];

  await page.route('**/api/github/repositories/*/release-target', (route) => json(route, TARGET));
  await page.route('**/api/github/repositories/*/changes*', (route) => json(route, CHANGES));

  await page.route('**/api/github/repositories/*/release-notes', async (route) => {
    const body = route.request().postDataJSON() as { tagName: string; targetCommitish: string };
    if (options.notesDelayMs) await new Promise((resolve) => setTimeout(resolve, options.notesDelayMs));
    await json(route, { name: body.tagName, body: `Notes for ${body.tagName} from ${body.targetCommitish}` });
  });

  // Matches the publish route only — the sibling paths above are registered first and win.
  await page.route(/\/api\/github\/repositories\/[^/]+\/releases$/, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    created.push({ payload: route.request().postDataJSON() });
    await json(route, { id: 1, tag_name: 'v1.3.1', html_url: 'https://github.com/x/y/releases/tag/v1.3.1' }, 201);
  });

  return created;
}

test.describe('Create release dialog', () => {
  let repoListPage: RepositoryListPage;

  test.beforeEach(async ({ page }) => {
    repoListPage = new RepositoryListPage(page);
  });

  test('should prefill the branch, tag and title from the release target', async ({ page }) => {
    await stubReleaseApi(page);
    await repoListPage.goto();
    await repoListPage.getReleaseButtons().first().click();

    await expect(repoListPage.releaseTagInput).toHaveValue('v1.3.1');
    await expect(repoListPage.releaseNameInput).toHaveValue('v1.3.1');
    await expect(page.locator('[data-testid="create-release-target-select"]')).toContainText('main');
  });

  test('should describe what has changed since the last release', async ({ page }) => {
    await stubReleaseApi(page);
    await repoListPage.goto();
    await repoListPage.getReleaseButtons().first().click();

    const summary = page.locator('[data-testid="create-release-changes"]');
    await expect(summary).toContainText('There have been');
    await expect(summary).toContainText('12 changes');
    await expect(summary).toContainText('v1.3.0');
    await expect(summary.locator('a', { hasText: 'v1.3.0' })).toHaveAttribute('href', CHANGES.previousReleaseUrl);
  });

  test('should fill the notes from the generated preview', async ({ page }) => {
    await stubReleaseApi(page);
    await repoListPage.goto();
    await repoListPage.getReleaseButtons().first().click();

    await expect(page.locator('[data-testid="create-release-body-textarea"] textarea')).toHaveValue('Notes for v1.3.1 from main', { timeout: 15000 });
  });

  test('should keep publish disabled until the generated notes settle', async ({ page }) => {
    await stubReleaseApi(page, { notesDelayMs: 2500 });
    await repoListPage.goto();
    await repoListPage.getReleaseButtons().first().click();

    // Publishing here would send an empty body, so the button must not be live yet.
    await expect(repoListPage.releaseSubmit).toBeDisabled();
    await expect(repoListPage.releaseSubmit).toBeEnabled({ timeout: 20000 });
  });

  test('should not overwrite notes the author has written', async ({ page }) => {
    await stubReleaseApi(page);
    await repoListPage.goto();
    await repoListPage.getReleaseButtons().first().click();

    const notes = page.locator('[data-testid="create-release-body-textarea"] textarea');
    await expect(notes).toHaveValue('Notes for v1.3.1 from main', { timeout: 15000 });

    await notes.fill('Hand written release notes');
    await repoListPage.releaseTagInput.fill('v2.0.0');

    // The tag change would normally refetch the preview; the author's text must survive it.
    await expect(repoListPage.releaseSubmit).toBeEnabled();
    await expect(notes).toHaveValue('Hand written release notes');
  });

  test('should publish the values shown in the form and close', async ({ page }) => {
    const created = await stubReleaseApi(page);
    await repoListPage.goto();
    await repoListPage.getReleaseButtons().first().click();

    await expect(page.locator('[data-testid="create-release-body-textarea"] textarea')).toHaveValue('Notes for v1.3.1 from main', { timeout: 15000 });
    await page.locator('[data-testid="create-release-prerelease-checkbox"]').check();
    await repoListPage.releaseSubmit.click();

    await expect(repoListPage.releaseDialog).not.toBeVisible({ timeout: 15000 });
    expect(created).toHaveLength(1);
    expect(created[0]!.payload).toMatchObject({
      tagName: 'v1.3.1',
      targetCommitish: 'main',
      name: 'v1.3.1',
      body: 'Notes for v1.3.1 from main',
      prerelease: true,
    });
  });

  test('should explain a duplicate tag rather than showing a generic failure', async ({ page }) => {
    await stubReleaseApi(page);
    await page.route(/\/api\/github\/repositories\/[^/]+\/releases$/, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Tag already exists: v1.3.1', code: 'CONFLICT' }),
      });
    });

    await repoListPage.goto();
    await repoListPage.getReleaseButtons().first().click();
    await expect(page.locator('[data-testid="create-release-body-textarea"] textarea')).toHaveValue('Notes for v1.3.1 from main', { timeout: 15000 });
    await repoListPage.releaseSubmit.click();

    await expect(repoListPage.releaseDialogError).toContainText('already exists', { timeout: 15000 });
    await expect(repoListPage.releaseDialog).toBeVisible();
  });
});
