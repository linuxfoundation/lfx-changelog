// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { createApiKeyContext, createAuthenticatedContext, createUnauthenticatedContext } from '../../helpers/api.helper.js';
import { TEST_FOREIGN_REPOSITORY } from '../../helpers/test-data.js';

import type { APIRequestContext } from '@playwright/test';

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

// Covers the contract only. Publishing calls GitHub, which the E2E environment has no
// credentials for, so the success path is not exercised here.
test.describe('Release creation API (/api/github/repositories)', () => {
  let unauthApi: APIRequestContext;
  let superAdminApi: APIRequestContext;
  let productAdminApi: APIRequestContext;
  let editorApi: APIRequestContext;

  test.beforeAll(async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    unauthApi = await createUnauthenticatedContext(baseURL);
    superAdminApi = await createAuthenticatedContext('super_admin', baseURL);
    productAdminApi = await createAuthenticatedContext('product_admin', baseURL);
    editorApi = await createAuthenticatedContext('editor', baseURL);
  });

  test.afterAll(async () => {
    await Promise.all([unauthApi.dispose(), superAdminApi.dispose(), productAdminApi.dispose(), editorApi.dispose()]);
  });

  test.describe('Authentication (401)', () => {
    test('GET /api/github/repositories/:repoId/target returns 401 without auth', async () => {
      const res = await unauthApi.get(`/api/github/repositories/${MISSING_ID}/release-target`);
      expect(res.status()).toBe(401);
      expect((await res.json()).code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('GET /api/github/repositories/:repoId/changes returns 401 without auth', async () => {
      const res = await unauthApi.get(`/api/github/repositories/${MISSING_ID}/changes?targetCommitish=main`);
      expect(res.status()).toBe(401);
    });

    test('POST /api/github/repositories/:repoId/notes returns 401 without auth', async () => {
      const res = await unauthApi.post(`/api/github/repositories/${MISSING_ID}/release-notes`, { data: { tagName: 'v1.0.0', targetCommitish: 'main' } });
      expect(res.status()).toBe(401);
    });

    test('POST /api/github/repositories/:repoId returns 401 without auth', async () => {
      const res = await unauthApi.post(`/api/github/repositories/${MISSING_ID}/releases`, {
        data: { tagName: 'v1.0.0', targetCommitish: 'main', name: 'v1.0.0', body: 'notes' },
      });
      expect(res.status()).toBe(401);
    });
  });

  test.describe('OAuth-Only Enforcement', () => {
    test('API key auth is rejected on /api/github/repositories/:repoId/target (403)', async ({}, testInfo) => {
      const baseURL = testInfo.project.use.baseURL as string;

      const createRes = await superAdminApi.post('/api/api-keys', {
        data: { name: 'release-oauth-only-test', scopes: ['products:read'], expiresInDays: 30 },
      });
      expect(createRes.status()).toBe(201);
      const { rawKey, apiKey } = (await createRes.json()).data;

      const apiKeyCtx = await createApiKeyContext(rawKey, baseURL);
      try {
        const res = await apiKeyCtx.get(`/api/github/repositories/${MISSING_ID}/release-target`);
        expect(res.status()).toBe(403);
        expect((await res.json()).code).toBe('AUTHORIZATION_REQUIRED');
      } finally {
        await apiKeyCtx.dispose();
        await superAdminApi.delete(`/api/api-keys/${apiKey.id}`);
      }
    });
  });

  test.describe('Authorization (403)', () => {
    test('editor cannot GET /api/github/repositories/:repoId/target (403)', async () => {
      const res = await editorApi.get(`/api/github/repositories/${MISSING_ID}/release-target`);
      expect(res.status()).toBe(403);
    });

    test('editor cannot GET /api/github/repositories/:repoId/changes (403)', async () => {
      const res = await editorApi.get(`/api/github/repositories/${MISSING_ID}/changes?targetCommitish=main`);
      expect(res.status()).toBe(403);
    });

    test('editor cannot POST /api/github/repositories/:repoId/notes (403)', async () => {
      const res = await editorApi.post(`/api/github/repositories/${MISSING_ID}/release-notes`, { data: { tagName: 'v1.0.0', targetCommitish: 'main' } });
      expect(res.status()).toBe(403);
    });

    test('editor cannot POST /api/github/repositories/:repoId (403)', async () => {
      const res = await editorApi.post(`/api/github/repositories/${MISSING_ID}/releases`, {
        data: { tagName: 'v1.0.0', targetCommitish: 'main', name: 'v1.0.0', body: 'notes' },
      });
      expect(res.status()).toBe(403);
    });
  });

  test.describe('Validation (400)', () => {
    test('POST /api/github/repositories/:repoId rejects a missing tagName', async () => {
      const res = await superAdminApi.post(`/api/github/repositories/${MISSING_ID}/releases`, {
        data: { targetCommitish: 'main', name: 'v1.0.0', body: 'notes' },
      });
      expect(res.status()).toBe(400);
      expect((await res.json()).code).toBe('VALIDATION_ERROR');
    });

    test('POST /api/github/repositories/:repoId rejects a whitespace-only tagName', async () => {
      const res = await superAdminApi.post(`/api/github/repositories/${MISSING_ID}/releases`, {
        data: { tagName: '   ', targetCommitish: 'main', name: 'v1.0.0', body: 'notes' },
      });
      expect(res.status()).toBe(400);
    });

    test('POST /api/github/repositories/:repoId rejects a missing targetCommitish', async () => {
      const res = await superAdminApi.post(`/api/github/repositories/${MISSING_ID}/releases`, {
        data: { tagName: 'v1.0.0', name: 'v1.0.0', body: 'notes' },
      });
      expect(res.status()).toBe(400);
    });

    test('GET /api/github/repositories/:repoId/changes rejects a missing targetCommitish', async () => {
      const res = await superAdminApi.get(`/api/github/repositories/${MISSING_ID}/changes`);
      expect(res.status()).toBe(400);
      expect((await res.json()).code).toBe('VALIDATION_ERROR');
    });

    test('POST /api/github/repositories/:repoId/notes rejects a missing targetCommitish', async () => {
      const res = await superAdminApi.post(`/api/github/repositories/${MISSING_ID}/release-notes`, { data: { tagName: 'v1.0.0' } });
      expect(res.status()).toBe(400);
      expect((await res.json()).code).toBe('VALIDATION_ERROR');
    });
  });

  test.describe('Not found (404)', () => {
    test('POST /api/github/repositories/:repoId returns 404 for an unknown repository, after validation', async () => {
      const res = await superAdminApi.post(`/api/github/repositories/${MISSING_ID}/releases`, {
        data: { tagName: 'v1.0.0', targetCommitish: 'main', name: 'v1.0.0', body: 'notes' },
      });
      expect(res.status()).toBe(404);
      expect((await res.json()).code).toBe('NOT_FOUND');
    });

    test('GET /api/github/repositories/:repoId/changes returns 404 for an unknown repository', async () => {
      const res = await superAdminApi.get(`/api/github/repositories/${MISSING_ID}/changes?targetCommitish=main`);
      expect(res.status()).toBe(404);
    });

    test('GET /api/github/repositories/:repoId/target returns 404 for an unknown repository', async () => {
      const res = await superAdminApi.get(`/api/github/repositories/${MISSING_ID}/release-target`);
      expect(res.status()).toBe(404);
    });

    test("GET /api/github/repositories/:repoId/target returns 404, not 403, for another product's repository", async () => {
      const listRes = await superAdminApi.get('/api/github/repositories');
      expect(listRes.status()).toBe(200);

      const repositories = (await listRes.json()).data as { id: string; fullName: string }[];
      const foreign = repositories.find((repository) => repository.fullName === TEST_FOREIGN_REPOSITORY.fullName);
      expect(foreign, `seeded repository ${TEST_FOREIGN_REPOSITORY.fullName} is missing`).toBeDefined();

      const res = await productAdminApi.get(`/api/github/repositories/${foreign!.id}/release-target`);
      expect(res.status()).toBe(404);
      expect((await res.json()).code).toBe('NOT_FOUND');
    });
  });
});
