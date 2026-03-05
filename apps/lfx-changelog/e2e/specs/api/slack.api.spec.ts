// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { createAuthenticatedContext, createUnauthenticatedContext } from '../../helpers/api.helper.js';

import type { APIRequestContext } from '@playwright/test';

test.describe('Slack API (/api/slack)', () => {
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
    test('GET /api/slack/connect returns 401 without auth', async () => {
      const res = await unauthApi.get('/api/slack/connect');
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('GET /api/slack/integrations returns 401 without auth', async () => {
      const res = await unauthApi.get('/api/slack/integrations');
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('DELETE /api/slack/integrations/:id returns 401 without auth', async () => {
      const res = await unauthApi.delete('/api/slack/integrations/fake-id');
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('AUTHENTICATION_REQUIRED');
    });
  });

  test.describe('GET /api/slack/connect', () => {
    let slackConfigured: boolean;

    test.beforeAll(async () => {
      const res = await superAdminApi.get('/api/slack/connect');
      slackConfigured = res.status() === 200;
    });

    test('returns OAuth URL when Slack is configured', async () => {
      test.skip(!slackConfigured, 'Slack OAuth not configured in this environment');
      const res = await superAdminApi.get('/api/slack/connect');
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.url).toBeDefined();
      expect(body.data.url).toContain('slack.com');
      expect(body.data.url).toContain('client_id');
      expect(body.data.url).toContain('user_scope');
      expect(body.data.url).toContain('state');
    });

    test('returns 503 when Slack is not configured', async () => {
      test.skip(slackConfigured, 'Slack OAuth is configured in this environment');
      const res = await superAdminApi.get('/api/slack/connect');
      expect(res.status()).toBe(503);
      const body = await res.json();
      expect(body.code).toBe('SERVICE_UNAVAILABLE');
    });

    test('editor can also access connect endpoint', async () => {
      const res = await editorApi.get('/api/slack/connect');
      // 200 if Slack configured, 503 if not — either way, not 401/403
      expect([200, 503]).toContain(res.status());
    });
  });

  test.describe('GET /api/slack/integrations', () => {
    test('returns empty array when user has no integrations', async () => {
      const res = await superAdminApi.get('/api/slack/integrations');
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    test('does not expose access tokens in response', async () => {
      const res = await superAdminApi.get('/api/slack/integrations');
      expect(res.status()).toBe(200);
      const body = await res.json();
      for (const integration of body.data) {
        expect(integration.accessToken).toBeUndefined();
        expect(integration.refreshToken).toBeUndefined();
      }
    });
  });

  test.describe('GET /api/slack/integrations/:id/channels', () => {
    test('returns error for non-existent integration', async () => {
      const res = await superAdminApi.get('/api/slack/integrations/00000000-0000-0000-0000-000000000000/channels');
      const status = res.status();
      // Should be 404 or 500 depending on implementation, but not 200
      expect(status).not.toBe(200);
    });
  });

  test.describe('DELETE /api/slack/integrations/:id', () => {
    test('returns error for non-existent integration', async () => {
      const res = await superAdminApi.delete('/api/slack/integrations/00000000-0000-0000-0000-000000000000');
      const status = res.status();
      expect(status).not.toBe(204);
    });
  });

  test.describe('POST /api/slack/integrations/:id/channels', () => {
    test('returns 400 with missing required fields', async () => {
      const res = await superAdminApi.post('/api/slack/integrations/fake-id/channels', {
        data: {},
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });
});

test.describe('Slack Share API (/api/changelogs/:id/share/slack)', () => {
  let unauthApi: APIRequestContext;
  let superAdminApi: APIRequestContext;
  let userApi: APIRequestContext;

  test.beforeAll(async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    unauthApi = await createUnauthenticatedContext(baseURL);
    superAdminApi = await createAuthenticatedContext('super_admin', baseURL);
    userApi = await createAuthenticatedContext('user', baseURL);
  });

  test.afterAll(async () => {
    await Promise.all([unauthApi.dispose(), superAdminApi.dispose(), userApi.dispose()]);
  });

  test('returns 401 without auth', async () => {
    const res = await unauthApi.post('/api/changelogs/fake-id/share/slack', {
      data: { channelId: 'C123' },
    });
    expect(res.status()).toBe(401);
  });

  test('returns 403 for user without editor role', async () => {
    const listRes = await superAdminApi.get('/api/changelogs');
    const entries = (await listRes.json()).data;
    const entryId = entries[0]?.id;
    if (!entryId) return;

    const res = await userApi.post(`/api/changelogs/${entryId}/share/slack`, {
      data: { channelId: 'C123' },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('AUTHORIZATION_REQUIRED');
  });

  test('returns 400 with missing channelId', async () => {
    // Get a real changelog ID first
    const listRes = await superAdminApi.get('/api/changelogs');
    const entries = (await listRes.json()).data;
    const entryId = entries[0]?.id;
    if (!entryId) return;

    const res = await superAdminApi.post(`/api/changelogs/${entryId}/share/slack`, {
      data: {},
      headers: { Origin: 'http://localhost:4204' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 404 for non-existent changelog', async () => {
    const res = await superAdminApi.post('/api/changelogs/00000000-0000-0000-0000-000000000000/share/slack', {
      data: { channelId: 'C123' },
      headers: { Origin: 'http://localhost:4204' },
    });
    expect(res.status()).toBe(404);
  });
});

test.describe('Slack OAuth Webhook (/webhooks/slack-callback)', () => {
  let unauthApi: APIRequestContext;

  test.beforeAll(async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    unauthApi = await createUnauthenticatedContext(baseURL);
  });

  test.afterAll(async () => {
    await unauthApi.dispose();
  });

  test('redirects to settings with error when code is missing', async () => {
    const res = await unauthApi.get('/webhooks/slack-callback', {
      maxRedirects: 0,
    });
    // Should redirect (302) to /admin/settings with error param
    expect(res.status()).toBe(302);
    const location = res.headers()['location'] ?? '';
    expect(location).toContain('/admin/settings');
    expect(location).toContain('slack_error');
  });

  test('redirects to settings with error when state is missing', async () => {
    const res = await unauthApi.get('/webhooks/slack-callback?code=fake-code', {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(302);
    const location = res.headers()['location'] ?? '';
    expect(location).toContain('/admin/settings');
    expect(location).toContain('slack_error');
  });

  test('redirects to settings with error when Slack returns error param', async () => {
    const res = await unauthApi.get('/webhooks/slack-callback?error=access_denied', {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(302);
    const location = res.headers()['location'] ?? '';
    expect(location).toContain('/admin/settings');
    expect(location).toContain('slack_error=access_denied');
  });

  test('redirects to settings with error for invalid state', async () => {
    const res = await unauthApi.get('/webhooks/slack-callback?code=fake-code&state=tampered-state', {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(302);
    const location = res.headers()['location'] ?? '';
    expect(location).toContain('/admin/settings');
    expect(location).toContain('slack_error');
  });
});
