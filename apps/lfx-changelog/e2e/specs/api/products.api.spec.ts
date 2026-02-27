// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { createAuthenticatedContext, createUnauthenticatedContext } from '../../helpers/api.helper.js';
import { TEST_PRODUCTS } from '../../helpers/test-data.js';

import type { APIRequestContext } from '@playwright/test';

test.describe('Protected Products API (/api/products)', () => {
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
    test('GET /api/products returns 401 without auth', async () => {
      const res = await unauthApi.get('/api/products');
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('POST /api/products returns 401 without auth', async () => {
      const res = await unauthApi.post('/api/products', { data: { name: 'Test', slug: 'test' } });
      expect(res.status()).toBe(401);
    });

    test('PUT /api/products/:id returns 401 without auth', async () => {
      const res = await unauthApi.put('/api/products/fake-id', { data: { name: 'Test' } });
      expect(res.status()).toBe(401);
    });

    test('DELETE /api/products/:id returns 401 without auth', async () => {
      const res = await unauthApi.delete('/api/products/fake-id');
      expect(res.status()).toBe(401);
    });
  });

  test.describe('Authorization (RBAC)', () => {
    test('editor can GET products (200)', async () => {
      const res = await editorApi.get('/api/products');
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    test('user with no roles gets 403 on GET (insufficient permissions)', async () => {
      const res = await userApi.get('/api/products');
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('AUTHORIZATION_REQUIRED');
    });

    test('editor cannot POST products (403)', async () => {
      const res = await editorApi.post('/api/products', {
        data: { name: 'Forbidden', slug: 'forbidden' },
      });
      expect(res.status()).toBe(403);
    });

    test('editor cannot DELETE products (403)', async () => {
      // Get a real product ID first
      const listRes = await superAdminApi.get('/api/products');
      const products = (await listRes.json()).data;
      const id = products[0].id;

      const res = await editorApi.delete(`/api/products/${id}`);
      expect(res.status()).toBe(403);
    });
  });

  test.describe('List & Detail', () => {
    test('should return full Product objects', async () => {
      const res = await superAdminApi.get('/api/products');
      expect(res.status()).toBe(200);

      const body = await res.json();
      const product = body.data.find((p: any) => p.slug === TEST_PRODUCTS[0]!.slug);
      expect(product).toBeDefined();
      expect(product.id).toBeDefined();
      expect(product.name).toBe(TEST_PRODUCTS[0]!.name);
      expect(product.createdAt).toBeDefined();
      expect(product.updatedAt).toBeDefined();
    });

    test('should return 404 for non-existent UUID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await superAdminApi.get(`/api/products/${fakeId}`);
      expect(res.status()).toBe(404);

      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });
  });

  test.describe('CRUD Lifecycle', () => {
    test('create → read → update → delete product (super_admin)', async () => {
      // CREATE
      const createRes = await superAdminApi.post('/api/products', {
        data: {
          name: 'API Test Product',
          slug: 'api-test-product',
          description: 'Created by API test',
          faIcon: 'fa-duotone fa-flask',
        },
      });
      expect(createRes.status()).toBe(201);
      const created = (await createRes.json()).data;
      expect(created.id).toBeDefined();
      expect(created.name).toBe('API Test Product');
      expect(created.slug).toBe('api-test-product');

      const productId = created.id;

      // READ
      const getRes = await superAdminApi.get(`/api/products/${productId}`);
      expect(getRes.status()).toBe(200);
      const fetched = (await getRes.json()).data;
      expect(fetched.id).toBe(productId);

      // UPDATE
      const updateRes = await superAdminApi.put(`/api/products/${productId}`, {
        data: { name: 'API Test Product Updated' },
      });
      expect(updateRes.status()).toBe(200);
      const updated = (await updateRes.json()).data;
      expect(updated.name).toBe('API Test Product Updated');

      // DELETE
      const deleteRes = await superAdminApi.delete(`/api/products/${productId}`);
      expect(deleteRes.status()).toBe(204);

      // VERIFY DELETED
      const verifyRes = await superAdminApi.get(`/api/products/${productId}`);
      expect(verifyRes.status()).toBe(404);
    });
  });

  test.describe('Validation', () => {
    test('POST with missing required fields returns 400', async () => {
      const res = await superAdminApi.post('/api/products', {
        data: { description: 'Missing name and slug' },
      });
      expect(res.status()).toBe(400);

      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(body.details)).toBe(true);
      expect(body.details.length).toBeGreaterThan(0);
    });
  });
});
