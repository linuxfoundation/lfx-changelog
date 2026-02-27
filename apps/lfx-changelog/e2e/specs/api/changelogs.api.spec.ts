// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { createAuthenticatedContext, createUnauthenticatedContext } from '../../helpers/api.helper.js';
import { TEST_CHANGELOGS } from '../../helpers/test-data.js';

import type { APIRequestContext } from '@playwright/test';

const TOTAL_CHANGELOGS = TEST_CHANGELOGS.length;

test.describe('Protected Changelogs API (/api/changelogs)', () => {
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
    test('GET /api/changelogs returns 401 without auth', async () => {
      const res = await unauthApi.get('/api/changelogs');
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('POST /api/changelogs returns 401 without auth', async () => {
      const res = await unauthApi.post('/api/changelogs', {
        data: { title: 'Test', description: 'Test', productId: 'fake', version: '1.0.0', status: 'draft' },
      });
      expect(res.status()).toBe(401);
    });
  });

  test.describe('Authorization (RBAC)', () => {
    test('user with no roles gets 401 on GET (no session for public-only login)', async () => {
      const res = await userApi.get('/api/changelogs');
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('super_admin can GET changelogs (200)', async () => {
      const res = await superAdminApi.get('/api/changelogs');
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    test('editor cannot DELETE changelogs (requires PRODUCT_ADMIN)', async () => {
      // Get a real changelog entry ID first
      const listRes = await superAdminApi.get('/api/changelogs');
      const entries = (await listRes.json()).data;
      const id = entries[0].id;

      const res = await editorApi.delete(`/api/changelogs/${id}`);
      expect(res.status()).toBe(403);
    });
  });

  test.describe('List', () => {
    test('should return all entries (published + draft) for super_admin', async () => {
      const res = await superAdminApi.get('/api/changelogs');
      const body = await res.json();

      expect(body.total).toBe(TOTAL_CHANGELOGS);
      expect(body.data).toHaveLength(TOTAL_CHANGELOGS);
    });

    test('should support pagination', async () => {
      const res = await superAdminApi.get('/api/changelogs?page=1&limit=2');
      const body = await res.json();

      expect(body.page).toBe(1);
      expect(body.pageSize).toBe(2);
      expect(body.data).toHaveLength(2);
      expect(body.totalPages).toBe(Math.ceil(TOTAL_CHANGELOGS / 2));
    });

    test('should include product and author relations', async () => {
      const res = await superAdminApi.get('/api/changelogs');
      const body = await res.json();
      const entry = body.data[0];

      expect(entry.product).toBeDefined();
      expect(entry.product.id).toBeDefined();
      expect(entry.author).toBeDefined();
      expect(entry.author.id).toBeDefined();
    });
  });

  test.describe('CRUD Lifecycle', () => {
    test('create → read → update → publish → delete changelog (super_admin)', async () => {
      // Discover a product ID from the seeded data
      const productsRes = await superAdminApi.get('/api/products');
      const products = (await productsRes.json()).data;
      const product = products.find((p: any) => p.slug === 'e2e-easycla');
      expect(product).toBeDefined();
      const productId = product.id;

      // CREATE (draft)
      const createRes = await superAdminApi.post('/api/changelogs', {
        data: {
          productId,
          title: 'API Test Changelog Entry',
          description: '## Test\n\nCreated by API test.',
          version: '99.0.0',
          status: 'draft',
        },
      });
      expect(createRes.status()).toBe(201);
      const created = (await createRes.json()).data;
      expect(created.id).toBeDefined();
      expect(created.title).toBe('API Test Changelog Entry');
      expect(created.status).toBe('draft');
      expect(created.publishedAt).toBeNull();

      const entryId = created.id;

      // READ
      const getRes = await superAdminApi.get(`/api/changelogs/${entryId}`);
      expect(getRes.status()).toBe(200);
      const fetched = (await getRes.json()).data;
      expect(fetched.id).toBe(entryId);
      expect(fetched.product.id).toBe(productId);

      // UPDATE
      const updateRes = await superAdminApi.put(`/api/changelogs/${entryId}`, {
        data: { title: 'API Test Changelog Updated' },
      });
      expect(updateRes.status()).toBe(200);
      const updated = (await updateRes.json()).data;
      expect(updated.title).toBe('API Test Changelog Updated');

      // PUBLISH
      const publishRes = await superAdminApi.patch(`/api/changelogs/${entryId}/publish`);
      expect(publishRes.status()).toBe(200);
      const published = (await publishRes.json()).data;
      expect(published.status).toBe('published');
      expect(published.publishedAt).not.toBeNull();

      // DELETE
      const deleteRes = await superAdminApi.delete(`/api/changelogs/${entryId}`);
      expect(deleteRes.status()).toBe(204);

      // VERIFY DELETED
      const verifyRes = await superAdminApi.get(`/api/changelogs/${entryId}`);
      expect(verifyRes.status()).toBe(404);
    });
  });

  test.describe('Validation', () => {
    test('POST with missing required fields returns 400', async () => {
      const res = await superAdminApi.post('/api/changelogs', {
        data: { title: 'Missing fields' },
      });
      expect(res.status()).toBe(400);

      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(body.details)).toBe(true);
      expect(body.details.length).toBeGreaterThan(0);
    });
  });
});
