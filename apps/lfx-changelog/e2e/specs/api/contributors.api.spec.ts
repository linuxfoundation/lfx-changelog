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

  test.describe('Seeded data', () => {
    test('excludes bots by default and includes them on request', async () => {
      const withoutBots = await (await superAdminApi.get('/api/contributors?limit=100')).json();
      const withBots = await (await superAdminApi.get('/api/contributors?limit=100&includeBots=true')).json();

      const logins = (list: { githubLogin: string }[]) => list.map((c) => c.githubLogin);
      expect(logins(withoutBots.data)).toContain('e2e-octo-dev');
      expect(logins(withoutBots.data)).not.toContain('e2e-testbot[bot]');
      expect(logins(withBots.data)).toContain('e2e-testbot[bot]');
    });

    test('includeBots=false is honoured rather than coerced to true', async () => {
      const res = await superAdminApi.get('/api/contributors?limit=100&includeBots=false');
      const body = await res.json();
      expect(body.data.map((c: { githubLogin: string }) => c.githubLogin)).not.toContain('e2e-testbot[bot]');
    });

    test('filters by Slack link state', async () => {
      const linked = await (await superAdminApi.get('/api/contributors?slackLink=linked&limit=100')).json();
      const unlinked = await (await superAdminApi.get('/api/contributors?slackLink=unlinked&limit=100')).json();

      expect(linked.data.every((c: { slackUserId: string | null }) => c.slackUserId !== null)).toBe(true);
      expect(unlinked.data.every((c: { slackUserId: string | null }) => c.slackUserId === null)).toBe(true);
      expect(unlinked.data.map((c: { githubLogin: string }) => c.githubLogin)).toContain('e2e-octo-dev');
    });

    test('returns the repositories a contributor belongs to', async () => {
      const list = await (await superAdminApi.get('/api/contributors?query=e2e-octo-dev')).json();
      const contributor = list.data[0];
      expect(contributor.repositories.length).toBeGreaterThan(0);
      expect(contributor.repositories[0].repositoryFullName).toBe('linuxfoundation/e2e-easycla-repo');
    });
  });

  test.describe('Slack linking', () => {
    test('PUT rejects a Slack user when no workspace is connected', async () => {
      const list = await (await superAdminApi.get('/api/contributors?query=e2e-octo-dev')).json();
      const res = await superAdminApi.put(`/api/contributors/${list.data[0].id}/slack`, { data: { slackUserId: 'U0NOTREAL' } });

      // No bot installation exists in E2E, so the directory lookup is unavailable — 503, not 500.
      expect(res.status()).toBe(503);
      const body = await res.json();
      expect(body.code).toBe('SERVICE_UNAVAILABLE');
    });

    // Uses a contributor reserved for this spec so the admin filter assertions stay stable.
    test('DELETE clears the Slack association', async () => {
      const list = await (await superAdminApi.get('/api/contributors?query=e2e-api-unlink-dev')).json();
      const contributor = list.data[0];
      expect(contributor.slackUserId).not.toBeNull();

      const res = await superAdminApi.delete(`/api/contributors/${contributor.id}/slack`);
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.data.slackUserId).toBeNull();
      expect(body.data.slackLinkSource).toBeNull();
      expect(body.data.slackLinkedAt).toBeNull();
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
