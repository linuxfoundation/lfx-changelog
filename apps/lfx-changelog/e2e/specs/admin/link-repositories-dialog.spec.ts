// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { LinkRepositoriesDialogPage } from '../../pages/link-repositories-dialog.page.js';

import type { GitHubInstallation, GitHubRepository, LinkRepositoryRequest } from '@lfx-changelog/shared';
import type { Page, Route } from '@playwright/test';

/**
 * The GitHub endpoints and the link POST are stubbed so the dialog can be exercised without a
 * GitHub App installation and without writing linked repositories to the test database.
 */
const INSTALLATION: GitHubInstallation = {
  id: 4242,
  account: { login: 'linuxfoundation', avatar_url: 'https://avatars.githubusercontent.com/u/1' },
  repository_selection: 'all',
  app_slug: 'lfx-changelog',
};

function repo(id: number, name: string, description: string | null, isPrivate: boolean): GitHubRepository {
  return {
    id,
    name,
    full_name: `linuxfoundation/${name}`,
    owner: { login: 'linuxfoundation' },
    html_url: `https://github.com/linuxfoundation/${name}`,
    description,
    private: isPrivate,
    language: null,
  };
}

const REPOS: GitHubRepository[] = [
  repo(1, 'LFF', 'Monorepo for Linux Foundation Fundspring Project', true),
  repo(2, 'jobspring', null, true),
  repo(3, 'easycla', null, false),
  repo(4, 'easycla-contributor-console', null, false),
  repo(5, 'myprofile', null, true),
  repo(6, 'lfx-pcc', 'LFX Project Control Center', true),
  repo(7, 'org-dashboard', null, true),
];

interface StubState {
  linked: LinkRepositoryRequest[];
  repoFetches: number;
}

function json(route: Route, data: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
}

async function stubLinkRepoApi(page: Page, options: { repos?: GitHubRepository[] } = {}): Promise<StubState> {
  const state: StubState = { linked: [], repoFetches: 0 };

  await page.route('**/api/github/installations', (route) => json(route, [INSTALLATION]));

  await page.route('**/api/github/installations/*/repositories', (route) => {
    state.repoFetches++;
    return json(route, options.repos ?? REPOS);
  });

  // Only the POST is stubbed; the tab's GET of already-linked repositories still reaches the server.
  await page.route('**/api/products/*/repositories', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    state.linked.push(route.request().postDataJSON() as LinkRepositoryRequest);
    return json(route, { id: `linked-${state.linked.length}` }, 201);
  });

  return state;
}

async function getProductId(page: Page): Promise<string> {
  const res = await page.request.get('/api/products');
  const products = (await res.json()).data as { id: string; slug: string }[];
  const easycla = products.find((product) => product.slug === 'e2e-easycla');
  expect(easycla, 'seeded product e2e-easycla is missing').toBeDefined();
  return easycla!.id;
}

async function expectVisibleRepos(dialog: LinkRepositoriesDialogPage, names: string[]) {
  await expect(dialog.visibleItems()).toHaveCount(names.length);
  for (const [index, name] of names.entries()) {
    await expect(dialog.visibleItems().nth(index)).toHaveAttribute('data-testid', `link-repos-item-linuxfoundation/${name}`);
  }
}

const ALL_NAMES = REPOS.map((r) => r.name);

test.describe('Link repositories dialog', () => {
  let dialog: LinkRepositoriesDialogPage;
  let api: StubState;

  test.beforeEach(async ({ page }) => {
    dialog = new LinkRepositoriesDialogPage(page);
    api = await stubLinkRepoApi(page);
    await dialog.open(await getProductId(page));
    await dialog.chooseOrganization('linuxfoundation');
    await dialog.next();
  });

  test('should list every repository in the organization with nothing selected', async () => {
    await expectVisibleRepos(dialog, ALL_NAMES);
    await expect(dialog.selectedCount).toContainText('0 selected');
  });

  test.describe('search by name', () => {
    test('should show an empty, labelled, focused search box', async ({ page }) => {
      const searchbox = page.getByRole('searchbox', { name: 'Search repositories by name' });
      await expect(searchbox).toBeVisible();
      await expect(searchbox).toHaveValue('');
      await expect(searchbox).toHaveAttribute('placeholder', 'Search repositories by name…');
      await expect(searchbox).toBeFocused();
    });

    test('should match part of the name and keep the original order', async () => {
      await dialog.search('easy');
      await expectVisibleRepos(dialog, ['easycla', 'easycla-contributor-console']);
    });

    test('should ignore letter case', async () => {
      await dialog.search('lff');
      await expectVisibleRepos(dialog, ['LFF']);

      await dialog.search('CLA');
      await expectVisibleRepos(dialog, ['easycla', 'easycla-contributor-console']);
    });

    test('should match anywhere in the name, not only the start', async () => {
      await dialog.search('pcc');
      await expectVisibleRepos(dialog, ['lfx-pcc']);
    });

    test('should not match on the description', async () => {
      await dialog.search('Control');
      await expectVisibleRepos(dialog, []);
    });

    test('should ignore surrounding spaces', async () => {
      await dialog.search('  easycla  ');
      await expectVisibleRepos(dialog, ['easycla', 'easycla-contributor-console']);

      await dialog.search('   ');
      await expectVisibleRepos(dialog, ALL_NAMES);
    });

    test('should match special characters literally', async () => {
      await dialog.search('-console');
      await expectVisibleRepos(dialog, ['easycla-contributor-console']);

      await dialog.search('.');
      await expectVisibleRepos(dialog, []);
    });

    test('should clear the search with the clear button', async () => {
      await expect(dialog.searchClearBtn).toBeHidden();

      await dialog.search('easy');
      await expect(dialog.searchClearBtn).toBeVisible();

      await dialog.clearSearch();
      await expect(dialog.searchInput).toHaveValue('');
      await expect(dialog.searchInput).toBeFocused();
      await expect(dialog.searchClearBtn).toBeHidden();
      await expectVisibleRepos(dialog, ALL_NAMES);
    });

    test('should not refetch repositories while typing', async () => {
      for (const term of ['e', 'ea', 'easy', 'my', '']) {
        await dialog.search(term);
      }
      await expectVisibleRepos(dialog, ALL_NAMES);
      expect(api.repoFetches).toBe(1);
    });

    test('should clear the search on Escape without closing the dialog or losing selections', async () => {
      await dialog.checkbox('linuxfoundation/easycla').check();
      await dialog.search('my');
      await dialog.searchInput.press('Escape');

      await expect(dialog.searchInput).toHaveValue('');
      await expect(dialog.searchInput).toBeFocused();
      await expect(dialog.dialog).toBeVisible();
      await expectVisibleRepos(dialog, ALL_NAMES);
      await expect(dialog.checkbox('linuxfoundation/easycla')).toBeChecked();
      await expect(dialog.selectedCount).toContainText('1 selected');
    });

    test('should close the dialog on Escape when the search is empty', async () => {
      await expect(dialog.searchInput).toBeFocused();
      await dialog.searchInput.press('Escape');
      await expect(dialog.dialog).toBeHidden();
    });
  });

  test.describe('search reset', () => {
    test('should reset the search after going back and forward', async () => {
      await dialog.search('zzz');
      await dialog.back();
      await dialog.next();

      await expect(dialog.searchInput).toHaveValue('');
      await expectVisibleRepos(dialog, ALL_NAMES);
    });

    test('should reset the search when the dialog is reopened', async () => {
      await dialog.search('zzz');
      await dialog.closeBtn.click();
      await expect(dialog.dialog).toBeHidden();

      await dialog.addRepositoryBtn.click();
      await dialog.chooseOrganization('linuxfoundation');
      await dialog.next();

      await expect(dialog.searchInput).toHaveValue('');
      await expectVisibleRepos(dialog, ALL_NAMES);
    });
  });

  test.describe('selection across searches', () => {
    const SELECTED = ['linuxfoundation/easycla', 'linuxfoundation/myprofile'];

    test.beforeEach(async () => {
      await dialog.search('easy');
      await dialog.checkbox('linuxfoundation/easycla').check();
      await dialog.search('myprofile');
      await dialog.checkbox('linuxfoundation/myprofile').check();
    });

    test('should count selections that the search hides', async () => {
      await expect(dialog.item('linuxfoundation/easycla')).toHaveCount(0);
      await expect(dialog.selectedCount).toContainText('2 selected');
      await expect(dialog.submitBtn).toContainText('Link Selected (2)');
    });

    test('should keep selections after the search is cleared', async () => {
      await dialog.clearSearch();
      await expectVisibleRepos(dialog, ALL_NAMES);

      for (const { full_name } of REPOS) {
        const checkbox = dialog.checkbox(full_name);
        if (SELECTED.includes(full_name)) {
          await expect(checkbox).toBeChecked();
        } else {
          await expect(checkbox).not.toBeChecked();
        }
      }
    });

    test('should link hidden selected repositories', async () => {
      await expect(dialog.item('linuxfoundation/easycla')).toHaveCount(0);
      await dialog.submitBtn.click();
      await expect(dialog.dialog).toBeHidden();

      expect(api.linked).toHaveLength(2);
      expect(new Set(api.linked.map((payload) => payload.fullName))).toEqual(new Set(SELECTED));
      for (const payload of api.linked) {
        expect(payload.githubInstallationId).toBe(INSTALLATION.id);
      }
    });
  });

  test.describe('no matches', () => {
    test('should explain that nothing matches and keep the search box', async () => {
      await dialog.search('zzzz-nothing');

      await expect(dialog.noMatches).toBeVisible();
      await expect(dialog.noMatches).toHaveText('No repositories match "zzzz-nothing".');
      await expect(dialog.searchInput).toBeVisible();
      await expect(dialog.list).toBeHidden();
      await expect(dialog.empty).toBeHidden();
    });

    test('should show the trimmed search in the message', async () => {
      await dialog.search('  zz  ');
      await expect(dialog.noMatches).toHaveText('No repositories match "zz".');
    });

    test('should show results again when the search changes', async () => {
      await dialog.search('zzzz-nothing');
      await expect(dialog.noMatches).toBeVisible();

      await dialog.search('easy');
      await expect(dialog.noMatches).toBeHidden();
      await expectVisibleRepos(dialog, ['easycla', 'easycla-contributor-console']);
    });
  });
});

test.describe('Link repositories dialog — empty organization', () => {
  test('should show the empty-organization message without a search box', async ({ page }) => {
    const dialog = new LinkRepositoriesDialogPage(page);
    await stubLinkRepoApi(page, { repos: [] });
    await dialog.open(await getProductId(page));
    await dialog.chooseOrganization('linuxfoundation');
    await dialog.next();

    await expect(dialog.empty).toBeVisible();
    await expect(dialog.empty).toHaveText('No repositories found for this installation.');
    await expect(dialog.searchInput).toHaveCount(0);
    await expect(dialog.noMatches).toHaveCount(0);
  });
});

test.describe('Link repositories dialog — install callback', () => {
  test('should start the repository step with an empty search', async ({ page }) => {
    const dialog = new LinkRepositoriesDialogPage(page);
    await stubLinkRepoApi(page);
    const productId = await getProductId(page);

    // A full page load renders on the server first, where these stubs don't apply. The server's
    // fetches for the fake installation fail, and failed responses aren't transferred to the
    // browser, so the browser fetches again and gets the stubbed data.
    await page.goto(`/admin/products/${productId}?tab=repositories&installation_id=${INSTALLATION.id}`, { waitUntil: 'networkidle' });

    await expect(dialog.searchInput).toBeVisible();
    await expect(dialog.searchInput).toHaveValue('');
    await expectVisibleRepos(dialog, ALL_NAMES);
  });
});
