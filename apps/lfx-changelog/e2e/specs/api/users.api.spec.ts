// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { createAuthenticatedContext, createUnauthenticatedContext } from '../../helpers/api.helper.js';
import { TEST_USERS } from '../../helpers/test-data.js';

import type { APIRequestContext } from '@playwright/test';

test.describe('Protected Users API (/api/users)', () => {
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
    test('GET /api/users/me returns 401 without auth', async () => {
      const res = await unauthApi.get('/api/users/me');
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('GET /api/users returns 401 without auth', async () => {
      const res = await unauthApi.get('/api/users');
      expect(res.status()).toBe(401);
    });
  });

  test.describe('GET /api/users/me', () => {
    test('super_admin gets their own user with roles', async () => {
      const res = await superAdminApi.get('/api/users/me');
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.email).toBe(TEST_USERS[0]!.email);
      expect(body.data.name).toBe(TEST_USERS[0]!.name);
      expect(Array.isArray(body.data.roles)).toBe(true);
      expect(body.data.roles.length).toBeGreaterThan(0);

      const superAdminRole = body.data.roles.find((r: any) => r.role === 'super_admin');
      expect(superAdminRole).toBeDefined();
    });

    test('editor gets their own user with roles', async () => {
      const res = await editorApi.get('/api/users/me');
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.data.email).toBe(TEST_USERS[2]!.email);
      expect(body.data.roles.length).toBeGreaterThan(0);

      const editorRole = body.data.roles.find((r: any) => r.role === 'editor');
      expect(editorRole).toBeDefined();
    });
  });

  test.describe('GET /api/users (list all)', () => {
    test('super_admin can list all users (200)', async () => {
      const res = await superAdminApi.get('/api/users');
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(TEST_USERS.length);
    });

    test('product_admin gets 403 on list users', async () => {
      const res = await productAdminApi.get('/api/users');
      expect(res.status()).toBe(403);
    });

    test('editor gets 403 on list users', async () => {
      const res = await editorApi.get('/api/users');
      expect(res.status()).toBe(403);
    });
  });

  test.describe('Role Lifecycle', () => {
    test('assign → verify → remove role (super_admin)', async () => {
      // Get the user (the "user" role user who has no role assignments)
      const usersRes = await superAdminApi.get('/api/users');
      const users = (await usersRes.json()).data;
      const targetUser = users.find((u: any) => u.email === TEST_USERS[3]!.email);
      expect(targetUser).toBeDefined();

      // Get a product ID for the role assignment
      const productsRes = await superAdminApi.get('/api/products');
      const products = (await productsRes.json()).data;
      const product = products.find((p: any) => p.slug === 'e2e-easycla');
      expect(product).toBeDefined();

      // ASSIGN ROLE
      const assignRes = await superAdminApi.post(`/api/users/${targetUser.id}/roles`, {
        data: { role: 'editor', productId: product.id },
      });
      expect(assignRes.status()).toBe(201);
      const assignment = (await assignRes.json()).data;
      expect(assignment.id).toBeDefined();
      expect(assignment.role).toBe('editor');
      const roleId = assignment.id;

      // VERIFY via GET /me would require the user's context, so verify via users list
      const verifyRes = await superAdminApi.get('/api/users');
      const updatedUsers = (await verifyRes.json()).data;
      const updatedUser = updatedUsers.find((u: any) => u.id === targetUser.id);
      const newRole = updatedUser.roles.find((r: any) => r.id === roleId);
      expect(newRole).toBeDefined();

      // REMOVE ROLE
      const removeRes = await superAdminApi.delete(`/api/users/${targetUser.id}/roles/${roleId}`);
      expect(removeRes.status()).toBe(204);

      // VERIFY REMOVED
      const finalRes = await superAdminApi.get('/api/users');
      const finalUsers = (await finalRes.json()).data;
      const finalUser = finalUsers.find((u: any) => u.id === targetUser.id);
      const removedRole = finalUser.roles.find((r: any) => r.id === roleId);
      expect(removedRole).toBeUndefined();
    });
  });

  test.describe('Validation', () => {
    test('POST role with invalid role returns 400', async () => {
      // Get any user ID
      const usersRes = await superAdminApi.get('/api/users');
      const users = (await usersRes.json()).data;
      const userId = users[0].id;

      const res = await superAdminApi.post(`/api/users/${userId}/roles`, {
        data: { role: 'invalid_role', productId: null },
      });
      expect(res.status()).toBe(400);
    });

    test('POST role with missing fields returns 400', async () => {
      const usersRes = await superAdminApi.get('/api/users');
      const users = (await usersRes.json()).data;
      const userId = users[0].id;

      const res = await superAdminApi.post(`/api/users/${userId}/roles`, {
        data: {},
      });
      expect(res.status()).toBe(400);
    });
  });
});
