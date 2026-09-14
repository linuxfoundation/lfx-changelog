// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { createAuthenticatedContext, createUnauthenticatedContext } from '../../helpers/api.helper.js';

import type { APIRequestContext } from '@playwright/test';

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

test.describe('Contributors API (/api/contributors)', () => {
  let unauthApi: APIRequestContext;
  let superAdminApi: APIRequestContext;
  let editorApi: APIRequestContext;

  test.beforeAll(async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    unauthApi = await createUnauthenticatedContext(baseURL);
    superAdminApi = await createAuthenticatedContext('super_admin', baseURL);
    editorApi = await createAuthenticatedContext('editor', baseURL);
  });

  test.afterAll(async () => {
    await Promise.all([unauthApi.dispose(), superAdminApi.dispose(), editorApi.dispose()]);
  });

  test.describe('Authentication (401)', () => {
    test('GET /api/contributors returns 401 without auth', async () => {
      const res = await unauthApi.get('/api/contributors');
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('POST /api/contributors/sync returns 401 without auth', async () => {
      const res = await unauthApi.post('/api/contributors/sync', { data: {} });
      expect(res.status()).toBe(401);
    });

    test('GET /api/contributors/slack-users returns 401 without auth', async () => {
      const res = await unauthApi.get('/api/contributors/slack-users');
      expect(res.status()).toBe(401);
    });
  });

  test.describe('Authorization (403)', () => {
    test('GET /api/contributors is forbidden for editor', async () => {
      const res = await editorApi.get('/api/contributors');
      expect(res.status()).toBe(403);
    });

    test('POST /api/contributors/sync is forbidden for editor', async () => {
      const res = await editorApi.post('/api/contributors/sync', { data: {} });
      expect(res.status()).toBe(403);
    });

    test('PUT /api/contributors/:id/slack is forbidden for editor', async () => {
      const res = await editorApi.put(`/api/contributors/${MISSING_ID}/slack`, { data: { slackUserId: 'U123' } });
      expect(res.status()).toBe(403);
    });
  });

  test.describe('List', () => {
    test('returns a paginated envelope for super_admin', async () => {
      const res = await superAdminApi.get('/api/contributors');
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(typeof body.total).toBe('number');
      expect(typeof body.page).toBe('number');
      expect(typeof body.pageSize).toBe('number');
      expect(typeof body.totalPages).toBe('number');
    });

    test('respects the limit query param', async () => {
      const res = await superAdminApi.get('/api/contributors?limit=5');
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.pageSize).toBe(5);
    });

    test('rejects an out-of-range limit', async () => {
      const res = await superAdminApi.get('/api/contributors?limit=500');
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    test('rejects an invalid slackLink filter', async () => {
      const res = await superAdminApi.get('/api/contributors?slackLink=maybe');
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  test.describe('Validation', () => {
    test('PUT /api/contributors/:id/slack requires slackUserId', async () => {
      const res = await superAdminApi.put(`/api/contributors/${MISSING_ID}/slack`, { data: {} });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    test('POST /api/contributors/sync rejects productId and repositoryId together', async () => {
      const res = await superAdminApi.post('/api/contributors/sync', {
        data: { productId: MISSING_ID, repositoryId: MISSING_ID },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  test.describe('Not found (404)', () => {
    test('GET /api/contributors/:id returns 404 for an unknown contributor', async () => {
      const res = await superAdminApi.get(`/api/contributors/${MISSING_ID}`);
      expect(res.status()).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });

    test('DELETE /api/contributors/:id/slack returns 404 for an unknown contributor', async () => {
      const res = await superAdminApi.delete(`/api/contributors/${MISSING_ID}/slack`);
      expect(res.status()).toBe(404);
    });
  });
});
