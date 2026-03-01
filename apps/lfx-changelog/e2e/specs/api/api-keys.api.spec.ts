// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { createApiKeyContext, createAuthenticatedContext, createUnauthenticatedContext } from '../../helpers/api.helper.js';

import type { APIRequestContext } from '@playwright/test';

test.describe('API Keys (/api/api-keys)', () => {
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
    test('GET /api/api-keys returns 401 without auth', async () => {
      const res = await unauthApi.get('/api/api-keys');
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('POST /api/api-keys returns 401 without auth', async () => {
      const res = await unauthApi.post('/api/api-keys', {
        data: { name: 'test', scopes: ['products:read'], expiresInDays: 30 },
      });
      expect(res.status()).toBe(401);
    });

    test('DELETE /api/api-keys/:id returns 401 without auth', async () => {
      const res = await unauthApi.delete('/api/api-keys/00000000-0000-0000-0000-000000000000');
      expect(res.status()).toBe(401);
    });
  });

  test.describe('OAuth-Only Enforcement', () => {
    test('API key auth is rejected on /api/api-keys (403)', async ({}, testInfo) => {
      const baseURL = testInfo.project.use.baseURL as string;

      // Create a key via OAuth first
      const createRes = await superAdminApi.post('/api/api-keys', {
        data: { name: 'oauth-only-test', scopes: ['products:read'], expiresInDays: 30 },
      });
      expect(createRes.status()).toBe(201);
      const { rawKey } = (await createRes.json()).data;

      // Use that key to call the api-keys endpoint
      const apiKeyCtx = await createApiKeyContext(rawKey, baseURL);
      try {
        const res = await apiKeyCtx.get('/api/api-keys');
        expect(res.status()).toBe(403);
        const body = await res.json();
        expect(body.code).toBe('AUTHORIZATION_REQUIRED');
      } finally {
        await apiKeyCtx.dispose();
      }
    });
  });

  test.describe('Role-Based Access (any OAuth user can manage own keys)', () => {
    test('super_admin can create, list, and revoke a key', async () => {
      // CREATE
      const createRes = await superAdminApi.post('/api/api-keys', {
        data: { name: 'sa-key', scopes: ['products:read'], expiresInDays: 30 },
      });
      expect(createRes.status()).toBe(201);
      const keyId = (await createRes.json()).data.apiKey.id;

      // LIST
      const listRes = await superAdminApi.get('/api/api-keys');
      expect(listRes.status()).toBe(200);
      const keys = (await listRes.json()).data;
      expect(keys.some((k: any) => k.id === keyId)).toBe(true);

      // REVOKE
      const revokeRes = await superAdminApi.delete(`/api/api-keys/${keyId}`);
      expect(revokeRes.status()).toBe(204);
    });

    test('editor can create, list, and revoke a key', async () => {
      // CREATE
      const createRes = await editorApi.post('/api/api-keys', {
        data: { name: 'editor-key', scopes: ['changelogs:read'], expiresInDays: 30 },
      });
      expect(createRes.status()).toBe(201);
      const keyId = (await createRes.json()).data.apiKey.id;

      // LIST
      const listRes = await editorApi.get('/api/api-keys');
      expect(listRes.status()).toBe(200);
      const keys = (await listRes.json()).data;
      expect(keys.some((k: any) => k.id === keyId)).toBe(true);

      // REVOKE
      const revokeRes = await editorApi.delete(`/api/api-keys/${keyId}`);
      expect(revokeRes.status()).toBe(204);
    });

    test('keys are user-scoped: editor cannot see super_admin keys', async () => {
      // super_admin creates a key
      const createRes = await superAdminApi.post('/api/api-keys', {
        data: { name: 'sa-scoped-key', scopes: ['products:read'], expiresInDays: 30 },
      });
      expect(createRes.status()).toBe(201);
      const saKeyId = (await createRes.json()).data.apiKey.id;

      // editor lists — should NOT see super_admin's key
      const listRes = await editorApi.get('/api/api-keys');
      expect(listRes.status()).toBe(200);
      const editorKeys = (await listRes.json()).data;
      expect(editorKeys.some((k: any) => k.id === saKeyId)).toBe(false);

      // Cleanup
      await superAdminApi.delete(`/api/api-keys/${saKeyId}`);
    });

    test('cross-user revoke: editor cannot revoke super_admin key (403)', async () => {
      // super_admin creates a key
      const createRes = await superAdminApi.post('/api/api-keys', {
        data: { name: 'sa-protected-key', scopes: ['products:read'], expiresInDays: 30 },
      });
      expect(createRes.status()).toBe(201);
      const saKeyId = (await createRes.json()).data.apiKey.id;

      // editor tries to revoke it
      const revokeRes = await editorApi.delete(`/api/api-keys/${saKeyId}`);
      expect(revokeRes.status()).toBe(403);

      // Cleanup
      await superAdminApi.delete(`/api/api-keys/${saKeyId}`);
    });
  });

  test.describe('CRUD Lifecycle (super_admin via OAuth)', () => {
    test('create → list → revoke → verify revokedAt', async () => {
      // CREATE
      const createRes = await superAdminApi.post('/api/api-keys', {
        data: { name: 'lifecycle-key', scopes: ['changelogs:read', 'products:read'], expiresInDays: 90 },
      });
      expect(createRes.status()).toBe(201);

      const createBody = (await createRes.json()).data;
      expect(createBody.rawKey).toBeDefined();
      expect(createBody.rawKey.startsWith('lfx_')).toBe(true);

      const apiKey = createBody.apiKey;
      expect(apiKey.id).toBeDefined();
      expect(apiKey.name).toBe('lifecycle-key');
      expect(apiKey.scopes).toEqual(expect.arrayContaining(['changelogs:read', 'products:read']));
      expect(apiKey.keyPrefix).toBeDefined();
      expect(apiKey.expiresAt).toBeDefined();
      expect(apiKey.revokedAt).toBeNull();
      expect(apiKey.createdAt).toBeDefined();

      // LIST — new key appears
      const listRes = await superAdminApi.get('/api/api-keys');
      expect(listRes.status()).toBe(200);
      const keys = (await listRes.json()).data;
      const found = keys.find((k: any) => k.name === 'lifecycle-key');
      expect(found).toBeDefined();

      // REVOKE
      const revokeRes = await superAdminApi.delete(`/api/api-keys/${apiKey.id}`);
      expect(revokeRes.status()).toBe(204);

      // LIST AGAIN — revokedAt is set
      const listRes2 = await superAdminApi.get('/api/api-keys');
      const keys2 = (await listRes2.json()).data;
      const revokedKey = keys2.find((k: any) => k.id === apiKey.id);
      expect(revokedKey).toBeDefined();
      expect(revokedKey.revokedAt).not.toBeNull();
    });
  });

  test.describe('Validation (400)', () => {
    test('missing name returns 400 VALIDATION_ERROR', async () => {
      const res = await superAdminApi.post('/api/api-keys', {
        data: { scopes: ['products:read'], expiresInDays: 30 },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    test('empty scopes returns 400 VALIDATION_ERROR', async () => {
      const res = await superAdminApi.post('/api/api-keys', {
        data: { name: 'bad-scopes', scopes: [], expiresInDays: 30 },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    test('expiresInDays > 365 returns 400 VALIDATION_ERROR', async () => {
      const res = await superAdminApi.post('/api/api-keys', {
        data: { name: 'too-long', scopes: ['products:read'], expiresInDays: 366 },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  test.describe('API Key Scope Enforcement (cross-route)', () => {
    let apiKeyCtx: APIRequestContext;

    test.beforeAll(async ({}, testInfo) => {
      const baseURL = testInfo.project.use.baseURL as string;

      // Create a key with products:read scope only
      const createRes = await superAdminApi.post('/api/api-keys', {
        data: { name: 'scope-test-key', scopes: ['products:read'], expiresInDays: 30 },
      });
      expect(createRes.status()).toBe(201);
      const { rawKey } = (await createRes.json()).data;
      apiKeyCtx = await createApiKeyContext(rawKey, baseURL);
    });

    test.afterAll(async () => {
      await apiKeyCtx.dispose();
    });

    test('GET /api/products succeeds with products:read scope (200)', async () => {
      const res = await apiKeyCtx.get('/api/products');
      expect(res.status()).toBe(200);
    });

    test('POST /api/products fails without products:write scope (403)', async () => {
      const res = await apiKeyCtx.post('/api/products', {
        data: { name: 'No Write', slug: 'no-write' },
      });
      expect(res.status()).toBe(403);
    });

    test('GET /api/changelogs fails without changelogs:read scope (403)', async () => {
      const res = await apiKeyCtx.get('/api/changelogs');
      expect(res.status()).toBe(403);
    });

    test('GET /api/users fails (role-only route, no API key scope available) (403)', async () => {
      const res = await apiKeyCtx.get('/api/users');
      expect(res.status()).toBe(403);
    });
  });

  test.describe('Revoked Key Rejection', () => {
    test('revoked key returns 401', async ({}, testInfo) => {
      const baseURL = testInfo.project.use.baseURL as string;

      // Create and immediately revoke
      const createRes = await superAdminApi.post('/api/api-keys', {
        data: { name: 'revoke-test', scopes: ['products:read'], expiresInDays: 30 },
      });
      expect(createRes.status()).toBe(201);
      const { rawKey, apiKey } = (await createRes.json()).data;

      const revokeRes = await superAdminApi.delete(`/api/api-keys/${apiKey.id}`);
      expect(revokeRes.status()).toBe(204);

      // Try to use the revoked key
      const revokedCtx = await createApiKeyContext(rawKey, baseURL);
      try {
        const res = await revokedCtx.get('/api/products');
        expect(res.status()).toBe(401);
      } finally {
        await revokedCtx.dispose();
      }
    });
  });
});
