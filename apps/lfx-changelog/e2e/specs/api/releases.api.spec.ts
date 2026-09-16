// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { createAuthenticatedContext, createUnauthenticatedContext } from '../../helpers/api.helper.js';
import { TEST_FOREIGN_REPOSITORY, TEST_REPOSITORY } from '../../helpers/test-data.js';

import type { APIRequestContext } from '@playwright/test';

test.describe('GitHub releases API (/api/github)', () => {
  let unauthApi: APIRequestContext;
  let superAdminApi: APIRequestContext;
  let productAdminApi: APIRequestContext;
  let editorApi: APIRequestContext;
  let userApi: APIRequestContext;

  test.beforeAll(async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    unauthApi = await createUnauthenticatedContext(baseURL);
    superAdminApi = await createAuthenticatedContext('super_admin', baseURL);
    productAdminApi = await createAuthenticatedContext('product_admin', baseURL);
    editorApi = await createAuthenticatedContext('editor', baseURL);
    userApi = await createAuthenticatedContext('user', baseURL);
  });

  test.afterAll(async () => {
    await Promise.all([unauthApi.dispose(), superAdminApi.dispose(), productAdminApi.dispose(), editorApi.dispose(), userApi.dispose()]);
  });

  test.describe('Authentication (401)', () => {
    test('GET /api/github/releases returns 401 without auth', async () => {
      const res = await unauthApi.get('/api/github/releases');
      expect(res.status()).toBe(401);
    });

    test('GET /api/github/repositories returns 401 without auth', async () => {
      const res = await unauthApi.get('/api/github/repositories');
      expect(res.status()).toBe(401);
    });

    test('POST /api/github/products/:productId/sync returns 401 without auth', async () => {
      const res = await unauthApi.post('/api/github/products/fake-id/sync');
      expect(res.status()).toBe(401);
    });

    test('POST /api/github/repositories/:repoId/sync returns 401 without auth', async () => {
      const res = await unauthApi.post('/api/github/repositories/fake-id/sync');
      expect(res.status()).toBe(401);
    });
  });

  test.describe('Authorization (RBAC)', () => {
    test('editor can GET /api/github/releases (200)', async () => {
      const res = await editorApi.get('/api/github/releases');
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    test('user with no roles gets 403 on GET /api/github/releases', async () => {
      const res = await userApi.get('/api/github/releases');
      expect(res.status()).toBe(403);
    });

    test('editor cannot GET /api/github/repositories (403 — SUPER_ADMIN only)', async () => {
      const res = await editorApi.get('/api/github/repositories');
      expect(res.status()).toBe(403);
    });

    test('editor cannot POST /api/github/products/:productId/sync (403)', async () => {
      const res = await editorApi.post('/api/github/products/fake-id/sync');
      expect(res.status()).toBe(403);
    });

    test('editor cannot POST /api/github/repositories/:repoId/sync (403)', async () => {
      const res = await editorApi.post('/api/github/repositories/fake-id/sync');
      expect(res.status()).toBe(403);
    });

    test('a product admin may sync a repository of a product it administers', async () => {
      const listRes = await superAdminApi.get('/api/github/repositories');
      const repositories = (await listRes.json()).data as { id: string; fullName: string }[];
      const owned = repositories.find((repository) => repository.fullName === TEST_REPOSITORY.fullName);
      expect(owned, `seeded repository ${TEST_REPOSITORY.fullName} is missing`).toBeDefined();

      // The sync itself calls GitHub, which this environment cannot reach, so only the
      // authorization outcome is asserted: it must not be refused.
      const res = await productAdminApi.post(`/api/github/repositories/${owned!.id}/sync`);
      expect(res.status()).not.toBe(403);
      expect(res.status()).not.toBe(404);
    });

    test("a product admin gets 404, not 403, syncing another product's repository", async () => {
      const listRes = await superAdminApi.get('/api/github/repositories');
      const repositories = (await listRes.json()).data as { id: string; fullName: string }[];
      const foreign = repositories.find((repository) => repository.fullName === TEST_FOREIGN_REPOSITORY.fullName);
      expect(foreign, `seeded repository ${TEST_FOREIGN_REPOSITORY.fullName} is missing`).toBeDefined();

      const res = await productAdminApi.post(`/api/github/repositories/${foreign!.id}/sync`);
      expect(res.status()).toBe(404);
      expect((await res.json()).code).toBe('NOT_FOUND');
    });
  });

  test.describe('List Releases', () => {
    test('super admin can list releases with valid response structure', async () => {
      const res = await superAdminApi.get('/api/github/releases');
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    test('should respect limit parameter', async () => {
      const res = await superAdminApi.get('/api/github/releases?limit=1');
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.data.length).toBeLessThanOrEqual(1);
    });
  });

  test.describe('Filter by repository', () => {
    async function repositoryIdFor(fullName: string): Promise<string> {
      const res = await superAdminApi.get('/api/github/repositories');
      const repositories = (await res.json()).data as { id: string; fullName: string }[];
      const match = repositories.find((repository) => repository.fullName === fullName);
      expect(match, `seeded repository ${fullName} is missing`).toBeDefined();
      return match!.id;
    }

    test("returns that repository's releases and excludes another repository's", async () => {
      const res = await superAdminApi.get(`/api/github/releases?repositoryId=${await repositoryIdFor(TEST_REPOSITORY.fullName)}`);
      expect(res.status()).toBe(200);

      const tags = ((await res.json()).data as { tagName: string; repositoryFullName: string }[]).map((r) => r.tagName);

      // Seeded on the requested repository...
      expect(tags).toContain('v1.0.0');
      expect(tags).toContain('v1.1.0');
      // ...and on the other one, so an ignored filter would surface it here.
      expect(tags).not.toContain('sec-v0.9.0');
    });

    test('excludes drafts, so the list matches the count shown in the UI', async () => {
      const res = await superAdminApi.get(`/api/github/releases?repositoryId=${await repositoryIdFor(TEST_REPOSITORY.fullName)}`);
      const tags = ((await res.json()).data as { tagName: string }[]).map((r) => r.tagName);

      expect(tags).not.toContain('v1.3.0-draft');
    });

    test("the release count on a product's repositories matches the filtered history", async () => {
      const productsRes = await superAdminApi.get('/api/products');
      const products = (await productsRes.json()).data as { id: string; slug: string }[];
      const easycla = products.find((product) => product.slug === 'e2e-easycla');
      expect(easycla, 'seeded product e2e-easycla is missing').toBeDefined();

      const reposRes = await superAdminApi.get(`/api/products/${easycla!.id}/repositories`);
      const repositories = (await reposRes.json()).data as { id: string; fullName: string; releaseCount: number }[];
      const tracked = repositories.find((repository) => repository.fullName === TEST_REPOSITORY.fullName);
      expect(tracked, `seeded repository ${TEST_REPOSITORY.fullName} is missing`).toBeDefined();

      const releasesRes = await superAdminApi.get(`/api/github/releases?repositoryId=${tracked!.id}`);
      const releases = (await releasesRes.json()).data as unknown[];

      expect(tracked!.releaseCount).toBe(releases.length);
    });

    /**
     * Pins the deliberate difference from the publish and sync routes: those are product-scoped
     * and answer 404 for another product's repository, while reading releases is org-wide for any
     * editor. If that ever needs narrowing, this test is what should fail first.
     */
    test('an editor may read releases for a repository outside their products', async () => {
      const foreignId = await repositoryIdFor(TEST_FOREIGN_REPOSITORY.fullName);

      const res = await editorApi.get(`/api/github/releases?repositoryId=${foreignId}`);
      expect(res.status()).toBe(200);

      const tags = ((await res.json()).data as { tagName: string }[]).map((r) => r.tagName);
      expect(tags).toContain('sec-v0.9.0');
    });

    test('an unknown repository id yields an empty list rather than an error', async () => {
      const res = await superAdminApi.get(`/api/github/releases?repositoryId=${'00000000-0000-0000-0000-000000000000'}`);
      expect(res.status()).toBe(200);
      expect((await res.json()).data).toEqual([]);
    });
  });

  test.describe('List Repositories', () => {
    test('super admin can list repositories with counts', async () => {
      const res = await superAdminApi.get('/api/github/repositories');
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);

      // Each item should have the expected shape
      if (body.data.length > 0) {
        const repo = body.data[0];
        expect(repo).toHaveProperty('id');
        expect(repo).toHaveProperty('fullName');
        expect(repo).toHaveProperty('releaseCount');
        expect(repo).toHaveProperty('productName');
        expect(typeof repo.releaseCount).toBe('number');
      }
    });
  });

  test.describe('Sync Endpoints', () => {
    test('sync for non-existent product returns empty result', async () => {
      const fakeProductId = '00000000-0000-0000-0000-000000000000';
      const res = await superAdminApi.post(`/api/github/products/${fakeProductId}/sync`);
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.synced).toBe(0);
    });

    test('sync for non-existent repository returns 404', async () => {
      const fakeRepoId = '00000000-0000-0000-0000-000000000000';
      const res = await superAdminApi.post(`/api/github/repositories/${fakeRepoId}/sync`);
      expect(res.status()).toBe(404);
    });
  });
});
