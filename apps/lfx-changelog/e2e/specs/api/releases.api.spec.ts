// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { createAuthenticatedContext, createUnauthenticatedContext } from '../../helpers/api.helper.js';

import type { APIRequestContext } from '@playwright/test';

test.describe('Releases API (/api/releases)', () => {
  let unauthApi: APIRequestContext;
  let superAdminApi: APIRequestContext;
  let editorApi: APIRequestContext;
  let userApi: APIRequestContext;

  test.beforeAll(async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    unauthApi = await createUnauthenticatedContext(baseURL);
    superAdminApi = await createAuthenticatedContext('super_admin', baseURL);
    editorApi = await createAuthenticatedContext('editor', baseURL);
    userApi = await createAuthenticatedContext('user', baseURL);
  });

  test.afterAll(async () => {
    await Promise.all([unauthApi.dispose(), superAdminApi.dispose(), editorApi.dispose(), userApi.dispose()]);
  });

  test.describe('Authentication (401)', () => {
    test('GET /api/releases returns 401 without auth', async () => {
      const res = await unauthApi.get('/api/releases');
      expect(res.status()).toBe(401);
    });

    test('GET /api/releases/repositories returns 401 without auth', async () => {
      const res = await unauthApi.get('/api/releases/repositories');
      expect(res.status()).toBe(401);
    });

    test('POST /api/releases/sync/:productId returns 401 without auth', async () => {
      const res = await unauthApi.post('/api/releases/sync/fake-id');
      expect(res.status()).toBe(401);
    });

    test('POST /api/releases/sync/repo/:repoId returns 401 without auth', async () => {
      const res = await unauthApi.post('/api/releases/sync/repo/fake-id');
      expect(res.status()).toBe(401);
    });
  });

  test.describe('Authorization (RBAC)', () => {
    test('editor can GET /api/releases (200)', async () => {
      const res = await editorApi.get('/api/releases');
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    test('user with no roles gets 403 on GET /api/releases', async () => {
      const res = await userApi.get('/api/releases');
      expect(res.status()).toBe(403);
    });

    test('editor cannot GET /api/releases/repositories (403 — SUPER_ADMIN only)', async () => {
      const res = await editorApi.get('/api/releases/repositories');
      expect(res.status()).toBe(403);
    });

    test('editor cannot POST /api/releases/sync/:productId (403)', async () => {
      const res = await editorApi.post('/api/releases/sync/fake-id');
      expect(res.status()).toBe(403);
    });

    test('editor cannot POST /api/releases/sync/repo/:repoId (403)', async () => {
      const res = await editorApi.post('/api/releases/sync/repo/fake-id');
      expect(res.status()).toBe(403);
    });
  });

  test.describe('List Releases', () => {
    test('super admin can list releases with valid response structure', async () => {
      const res = await superAdminApi.get('/api/releases');
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    test('should respect limit parameter', async () => {
      const res = await superAdminApi.get('/api/releases?limit=1');
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.data.length).toBeLessThanOrEqual(1);
    });
  });

  test.describe('List Repositories', () => {
    test('super admin can list repositories with counts', async () => {
      const res = await superAdminApi.get('/api/releases/repositories');
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
      const res = await superAdminApi.post(`/api/releases/sync/${fakeProductId}`);
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.synced).toBe(0);
    });

    test('sync for non-existent repository returns 404', async () => {
      const fakeRepoId = '00000000-0000-0000-0000-000000000000';
      const res = await superAdminApi.post(`/api/releases/sync/repo/${fakeRepoId}`);
      expect(res.status()).toBe(404);
    });
  });
});
