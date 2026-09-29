// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { createHash, randomBytes } from 'node:crypto';

import { createApiKeyContext, createAuthenticatedContext, createUnauthenticatedContext } from '../../helpers/api.helper.js';
import { getTestPrismaClient } from '../../helpers/db.helper.js';
import { TEST_PRODUCTS, TEST_USERS } from '../../helpers/test-data.js';

import { BOT_EMAIL, BOT_NAME } from '@lfx-changelog/shared';

import type { Product, User } from '@lfx-changelog/shared';
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

  test.describe('Edit, deactivate, reactivate', () => {
    let testProductId: string;

    test.beforeAll(async () => {
      const productsRes = await superAdminApi.get('/api/products');
      const products = (await productsRes.json()).data;
      testProductId = products.find((p: Product) => p.slug === TEST_PRODUCTS[0]!.slug)!.id;
    });

    async function createThrowaway(): Promise<{ id: string; email: string; name: string }> {
      const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const email = `e2e-deactivate-${stamp}@example.com`;
      const name = `E2E Deactivate ${stamp}`;
      const res = await superAdminApi.post('/api/users', { data: { email, name, role: 'editor', productId: testProductId } });
      expect(res.status()).toBe(201);
      return { id: (await res.json()).data.id, email, name };
    }

    test('returns 401 without auth', async () => {
      const res = await unauthApi.post('/api/users/00000000-0000-0000-0000-000000000000/deactivate');
      expect(res.status()).toBe(401);
    });

    test('product_admin and editor get 403 on deactivate and reactivate', async () => {
      const throwaway = await createThrowaway();
      for (const api of [productAdminApi, editorApi]) {
        expect((await api.post(`/api/users/${throwaway.id}/deactivate`)).status()).toBe(403);
        expect((await api.post(`/api/users/${throwaway.id}/reactivate`)).status()).toBe(403);
      }
    });

    test('returns 404 for unknown id', async () => {
      const res = await superAdminApi.post('/api/users/00000000-0000-0000-0000-000000000000/deactivate');
      expect(res.status()).toBe(404);
    });

    test('super_admin cannot deactivate themselves', async () => {
      const me = (await (await superAdminApi.get('/api/users/me')).json()).data;
      const res = await superAdminApi.post(`/api/users/${me.id}/deactivate`);
      expect(res.status()).toBe(403);
      expect((await res.json()).error).toBe('You cannot deactivate your own account');
    });

    test('deactivating strips roles and Slack subscriptions, blocks re-granting them, and keeps the user listed', async () => {
      const throwaway = await createThrowaway();
      const prisma = getTestPrismaClient();
      await prisma.productSlackNotifyUser.create({ data: { productId: testProductId, userId: throwaway.id } });

      const res = await superAdminApi.post(`/api/users/${throwaway.id}/deactivate`);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.data.deactivatedAt).not.toBeNull();
      expect(body.data.roles).toEqual([]);

      const listed = (await (await superAdminApi.get('/api/users')).json()).data.find((u: User) => u.id === throwaway.id);
      expect(listed.deactivatedAt).not.toBeNull();

      const assignRes = await superAdminApi.post(`/api/users/${throwaway.id}/roles`, { data: { role: 'editor', productId: testProductId } });
      expect(assignRes.status()).toBe(409);

      expect(await prisma.productSlackNotifyUser.count({ where: { userId: throwaway.id } })).toBe(0);
      const notifyRes = await superAdminApi.post(`/api/products/${testProductId}/notify-users`, { data: { userId: throwaway.id } });
      expect(notifyRes.status()).toBe(409);

      const again = await superAdminApi.post(`/api/users/${throwaway.id}/deactivate`);
      expect(again.status()).toBe(200);
    });

    test('re-adding a deactivated email returns 409 pointing at reactivate', async () => {
      const throwaway = await createThrowaway();
      await superAdminApi.post(`/api/users/${throwaway.id}/deactivate`);

      const res = await superAdminApi.post('/api/users', {
        data: { email: throwaway.email, name: throwaway.name, role: 'editor', productId: testProductId },
      });
      expect(res.status()).toBe(409);
      expect((await res.json()).error).toContain('is deactivated');
    });

    test('a deactivated user no longer resolves from their session', async () => {
      const prisma = getTestPrismaClient();
      const editorEmail = TEST_USERS[2]!.email;
      expect((await editorApi.get('/api/changelogs?limit=1')).status()).toBe(200);

      await prisma.user.update({ where: { email: editorEmail }, data: { deactivatedAt: new Date() } });
      try {
        expect((await editorApi.get('/api/changelogs?limit=1')).status()).toBe(403);
        expect((await editorApi.get('/api/users/me')).status()).toBe(403);
      } finally {
        await prisma.user.update({ where: { email: editorEmail }, data: { deactivatedAt: null } });
      }
    });

    test('a key or role that escapes deactivation is rejected, and cleared on reactivate', async ({}, testInfo) => {
      const throwaway = await createThrowaway();
      const rawKey = 'lfx_' + randomBytes(24).toString('base64url');
      const prisma = getTestPrismaClient();
      await prisma.apiKey.create({
        data: {
          userId: throwaway.id,
          name: 'deactivated-owner-key',
          keyPrefix: rawKey.slice(0, 12),
          keyHash: createHash('sha256').update(rawKey).digest('hex'),
          scopes: ['products_read'],
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });

      const keyApi = await createApiKeyContext(rawKey, testInfo.project.use.baseURL as string);
      try {
        expect((await superAdminApi.post(`/api/users/${throwaway.id}/deactivate`)).status()).toBe(200);
        await prisma.apiKey.updateMany({ where: { userId: throwaway.id }, data: { revokedAt: null } });
        expect((await keyApi.get('/api/products')).status()).toBe(401);

        await prisma.userRoleAssignment.create({ data: { userId: throwaway.id, role: 'editor', productId: testProductId } });
        const reactivated = (await (await superAdminApi.post(`/api/users/${throwaway.id}/reactivate`)).json()).data;
        expect(reactivated.roles).toEqual([]);
        expect((await keyApi.get('/api/products')).status()).toBe(401);
      } finally {
        await keyApi.dispose();
      }
    });

    test('the automation bot cannot be deactivated or have its email changed', async () => {
      const bot = await getTestPrismaClient().user.upsert({
        where: { email: BOT_EMAIL },
        update: {},
        create: { email: BOT_EMAIL, name: BOT_NAME, auth0Id: null, avatarUrl: null },
      });

      const deactivateRes = await superAdminApi.post(`/api/users/${bot.id}/deactivate`);
      expect(deactivateRes.status()).toBe(409);
      expect((await deactivateRes.json()).error).toBe('The automation bot cannot be deactivated');

      const patchRes = await superAdminApi.patch(`/api/users/${bot.id}`, { data: { email: `renamed-${BOT_EMAIL}` } });
      expect(patchRes.status()).toBe(409);
      expect((await patchRes.json()).error).toBe("The automation bot's email cannot be changed");
    });

    test('BOT_EMAIL is reserved: it cannot be given to another user or used for a new one', async () => {
      const throwaway = await createThrowaway();
      const patchRes = await superAdminApi.patch(`/api/users/${throwaway.id}`, { data: { email: BOT_EMAIL } });
      expect(patchRes.status()).toBe(409);
      expect((await patchRes.json()).error).toBe('That email is reserved for the automation bot');

      const createRes = await superAdminApi.post('/api/users', { data: { email: BOT_EMAIL, name: 'Impostor', role: 'editor', productId: testProductId } });
      expect(createRes.status()).toBe(409);
      expect((await createRes.json()).error).toBe('That email is reserved for the automation bot');
    });

    test('personal API keys stop working after deactivate and stay revoked after reactivate', async ({}, testInfo) => {
      const throwaway = await createThrowaway();
      const rawKey = 'lfx_' + randomBytes(24).toString('base64url');
      await getTestPrismaClient().apiKey.create({
        data: {
          userId: throwaway.id,
          name: 'deactivate-test-key',
          keyPrefix: rawKey.slice(0, 12),
          keyHash: createHash('sha256').update(rawKey).digest('hex'),
          scopes: ['products_read'],
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });

      const keyApi = await createApiKeyContext(rawKey, testInfo.project.use.baseURL as string);
      try {
        expect((await keyApi.get('/api/products')).status()).toBe(200);

        expect((await superAdminApi.post(`/api/users/${throwaway.id}/deactivate`)).status()).toBe(200);
        expect((await keyApi.get('/api/products')).status()).toBe(401);

        const reactivateRes = await superAdminApi.post(`/api/users/${throwaway.id}/reactivate`);
        expect(reactivateRes.status()).toBe(200);
        const reactivated = (await reactivateRes.json()).data;
        expect(reactivated.deactivatedAt).toBeNull();
        expect(reactivated.roles).toEqual([]);
        expect((await keyApi.get('/api/products')).status()).toBe(401);
      } finally {
        await keyApi.dispose();
      }
    });

    test('PATCH is Super Admin only', async () => {
      const throwaway = await createThrowaway();
      for (const api of [productAdminApi, editorApi]) {
        expect((await api.patch(`/api/users/${throwaway.id}`, { data: { name: 'Nope' } })).status()).toBe(403);
      }
    });

    test('PATCH with an empty body returns 400', async () => {
      const throwaway = await createThrowaway();
      expect((await superAdminApi.patch(`/api/users/${throwaway.id}`, { data: {} })).status()).toBe(400);
    });

    test('PATCH updates name and email', async () => {
      const throwaway = await createThrowaway();
      const newEmail = `renamed-${throwaway.email}`;
      const res = await superAdminApi.patch(`/api/users/${throwaway.id}`, { data: { name: 'E2E Renamed', email: newEmail } });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.data.name).toBe('E2E Renamed');
      expect(body.data.email).toBe(newEmail);
      expect(body.data.roles.length).toBeGreaterThan(0);
    });

    test('PATCH to an email already in use returns 409', async () => {
      const [a, b] = [await createThrowaway(), await createThrowaway()];
      const res = await superAdminApi.patch(`/api/users/${a.id}`, { data: { email: b.email } });
      expect(res.status()).toBe(409);
    });

    test('super_admin cannot change their own email', async () => {
      const me = (await (await superAdminApi.get('/api/users/me')).json()).data;
      const res = await superAdminApi.patch(`/api/users/${me.id}`, { data: { email: `changed-${me.email}` } });
      expect(res.status()).toBe(403);
      expect((await res.json()).error).toBe('You cannot change your own email');
    });

    test('a reactivated user can be given roles again', async () => {
      const throwaway = await createThrowaway();
      await superAdminApi.post(`/api/users/${throwaway.id}/deactivate`);
      await superAdminApi.post(`/api/users/${throwaway.id}/reactivate`);

      const res = await superAdminApi.post(`/api/users/${throwaway.id}/roles`, { data: { role: 'editor', productId: testProductId } });
      expect(res.status()).toBe(201);
    });
  });
});
