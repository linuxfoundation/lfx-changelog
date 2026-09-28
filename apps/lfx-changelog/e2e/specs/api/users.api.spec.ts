// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { createAuthenticatedContext, createUnauthenticatedContext } from '../../helpers/api.helper.js';
import { TEST_PRODUCTS, TEST_USERS } from '../../helpers/test-data.js';

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

  test.describe('POST /api/users (create)', () => {
    let testProductId: string;

    test.beforeAll(async () => {
      const productsRes = await superAdminApi.get('/api/products');
      const products = (await productsRes.json()).data;
      const product = products.find((p: any) => p.slug === TEST_PRODUCTS[0]!.slug);
      testProductId = product.id;
    });

    test('creates user with role atomically (201)', async () => {
      const email = `e2e-create-${Date.now()}@example.com`;
      const res = await superAdminApi.post('/api/users', {
        data: { email, name: 'E2E Created User', role: 'editor', productId: testProductId },
      });
      expect(res.status()).toBe(201);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.email).toBe(email);
      expect(Array.isArray(body.data.roles)).toBe(true);
      expect(body.data.roles).toHaveLength(1);
      expect(body.data.roles[0].role).toBe('editor');
    });

    test('returns 409 when email already exists', async () => {
      const res = await superAdminApi.post('/api/users', {
        data: { email: TEST_USERS[0]!.email, name: 'Duplicate', role: 'editor', productId: testProductId },
      });
      expect(res.status()).toBe(409);

      const body = await res.json();
      expect(body.code).toBe('CONFLICT');
    });

    test('returns 409 on concurrent duplicate creation', async () => {
      const email = `e2e-race-${Date.now()}@example.com`;
      const payload = { email, name: 'E2E Race User', role: 'editor', productId: testProductId };

      const [res1, res2] = await Promise.all([superAdminApi.post('/api/users', { data: payload }), superAdminApi.post('/api/users', { data: payload })]);

      const statuses = [res1.status(), res2.status()].sort();
      expect(statuses).toEqual([201, 409]);
    });

    test('product_admin gets 403 on create user', async () => {
      const res = await productAdminApi.post('/api/users', {
        data: { email: 'forbidden@example.com', name: 'Forbidden', role: 'editor', productId: testProductId },
      });
      expect(res.status()).toBe(403);
    });

    test('editor gets 403 on create user', async () => {
      const res = await editorApi.post('/api/users', {
        data: { email: 'forbidden@example.com', name: 'Forbidden', role: 'editor', productId: testProductId },
      });
      expect(res.status()).toBe(403);
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

  test.describe('DELETE /api/users/:id', () => {
    let testProductId: string;

    test.beforeAll(async () => {
      const productsRes = await superAdminApi.get('/api/products');
      const products = (await productsRes.json()).data;
      const product = products.find((p: any) => p.slug === TEST_PRODUCTS[0]!.slug);
      testProductId = product.id;
    });

    async function createThrowaway(role: 'editor' | 'super_admin' = 'editor'): Promise<{ id: string; email: string; name: string }> {
      const email = `e2e-delete-${role}-${Date.now()}@example.com`;
      const name = `E2E Delete ${role} ${Date.now()}`;
      const res = await superAdminApi.post('/api/users', {
        data: { email, name, role, productId: role === 'super_admin' ? undefined : testProductId },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      return { id: body.data.id, email, name };
    }

    test('returns 401 without auth', async () => {
      const res = await unauthApi.delete('/api/users/00000000-0000-0000-0000-000000000000');
      expect(res.status()).toBe(401);
    });

    test('editor gets 403', async () => {
      const throwaway = await createThrowaway();
      const res = await editorApi.delete(`/api/users/${throwaway.id}`);
      expect(res.status()).toBe(403);
    });

    test('product_admin gets 403', async () => {
      const throwaway = await createThrowaway();
      const res = await productAdminApi.delete(`/api/users/${throwaway.id}`);
      expect(res.status()).toBe(403);
    });

    test('returns 404 for unknown id', async () => {
      const res = await superAdminApi.delete('/api/users/00000000-0000-0000-0000-000000000000');
      expect(res.status()).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });

    test('returns 403 when deleting self if another Super Admin remains', async () => {
      const extraSa = await createThrowaway('super_admin');
      try {
        const meRes = await superAdminApi.get('/api/users/me');
        const me = (await meRes.json()).data;
        const res = await superAdminApi.delete(`/api/users/${me.id}`);
        expect(res.status()).toBe(403);
        const body = await res.json();
        expect(body.error).toBe('You cannot remove your own account');
      } finally {
        await superAdminApi.delete(`/api/users/${extraSa.id}`);
      }
    });

    test('returns 409 when deleting the last Super Admin', async () => {
      const meRes = await superAdminApi.get('/api/users/me');
      const me = (await meRes.json()).data;
      const listRes = await superAdminApi.get('/api/users');
      const users = (await listRes.json()).data as Array<{ id: string; email: string; roles?: Array<{ role: string }> }>;
      for (const user of users) {
        const isSuperAdmin = user.roles?.some((role) => role.role === 'super_admin');
        if (isSuperAdmin && user.id !== me.id && user.email.includes('e2e-delete-')) {
          await superAdminApi.delete(`/api/users/${user.id}`);
        }
      }

      const res = await superAdminApi.delete(`/api/users/${me.id}`);
      expect(res.status()).toBe(409);
      const body = await res.json();
      expect(body.code).toBe('CONFLICT');
      expect(body.error).toBe('The last Super Admin cannot be removed');
    });

    test('super_admin can delete a throwaway user (204)', async () => {
      const throwaway = await createThrowaway();
      const res = await superAdminApi.delete(`/api/users/${throwaway.id}`);
      expect(res.status()).toBe(204);

      const listRes = await superAdminApi.get('/api/users');
      const users = (await listRes.json()).data;
      expect(users.find((u: any) => u.id === throwaway.id)).toBeUndefined();
    });

    test('retains authored content with author.former === true', async () => {
      const throwaway = await createThrowaway();
      const slug = `e2e-former-author-${Date.now()}`;
      const createRes = await superAdminApi.post('/api/changelogs', {
        data: {
          productId: testProductId,
          slug,
          title: 'Former author entry',
          description: 'Written by a user who will be removed.',
          version: '0.0.1',
          status: 'draft',
        },
      });
      expect(createRes.status()).toBe(201);
      const entryId = (await createRes.json()).data.id;

      const reassignRes = await superAdminApi.put(`/api/changelogs/${entryId}`, {
        data: { createdBy: throwaway.id },
      });
      expect(reassignRes.status()).toBe(200);

      const publishRes = await superAdminApi.patch(`/api/changelogs/${entryId}/publish`);
      expect(publishRes.status()).toBe(200);

      const deleteRes = await superAdminApi.delete(`/api/users/${throwaway.id}`);
      expect(deleteRes.status()).toBe(204);

      const publicRes = await unauthApi.get(`/public/api/changelogs/${slug}`);
      expect(publicRes.status()).toBe(200);
      const author = (await publicRes.json()).data.author;
      expect(author.name).toBe(throwaway.name);
      expect(author.former).toBe(true);
      expect(author.id).toBeNull();
    });

    test('re-adding the same email creates a new user id', async () => {
      const throwaway = await createThrowaway();
      const { email, name } = throwaway;
      const deleteRes = await superAdminApi.delete(`/api/users/${throwaway.id}`);
      expect(deleteRes.status()).toBe(204);

      const recreateRes = await superAdminApi.post('/api/users', {
        data: { email, name, role: 'editor', productId: testProductId },
      });
      expect(recreateRes.status()).toBe(201);
      const recreated = (await recreateRes.json()).data;
      expect(recreated.id).not.toBe(throwaway.id);
      expect(recreated.email).toBe(email);
    });

    test('personal API keys stop working after delete', async ({}, testInfo) => {
      const { createHash, randomBytes } = await import('node:crypto');
      const { getTestPrismaClient } = await import('../../helpers/db.helper.js');
      const { createApiKeyContext } = await import('../../helpers/api.helper.js');

      const throwaway = await createThrowaway();
      const rawKey = 'lfx_' + randomBytes(24).toString('base64url');
      const prisma = getTestPrismaClient();
      await prisma.apiKey.create({
        data: {
          userId: throwaway.id,
          name: 'delete-test-key',
          keyPrefix: rawKey.slice(0, 12),
          keyHash: createHash('sha256').update(rawKey).digest('hex'),
          scopes: ['products_read'],
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      const baseURL = testInfo.project.use.baseURL as string;
      const keyCtx = await createApiKeyContext(rawKey, baseURL);
      try {
        const before = await keyCtx.get('/api/products');
        expect(before.status()).toBe(200);

        const deleteRes = await superAdminApi.delete(`/api/users/${throwaway.id}`);
        expect(deleteRes.status()).toBe(204);

        const after = await keyCtx.get('/api/products');
        expect(after.status()).toBe(401);
      } finally {
        await keyCtx.dispose();
      }
    });
  });
});
