// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, request, test } from '@playwright/test';
import { createAuthenticatedContext, createUnauthenticatedContext } from '../../helpers/api.helper.js';
import { getTestPrismaClient } from '../../helpers/db.helper.js';

import type { APIRequestContext } from '@playwright/test';

test.describe('Chat API', () => {
  /** No Origin header — for testing 401 on protected routes (auth middleware runs first). */
  let unauthApi: APIRequestContext;
  /** With Origin header — simulates same-origin browser requests for public chat routes. */
  let publicChatApi: APIRequestContext;
  let superAdminApi: APIRequestContext;
  let editorApi: APIRequestContext;

  test.beforeAll(async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    unauthApi = await createUnauthenticatedContext(baseURL);
    publicChatApi = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
    superAdminApi = await createAuthenticatedContext('super_admin', baseURL);
    editorApi = await createAuthenticatedContext('editor', baseURL);
  });

  test.afterAll(async () => {
    // Clean up chat conversations created during tests
    const prisma = getTestPrismaClient();
    await prisma.chatMessage.deleteMany();
    await prisma.chatConversation.deleteMany();
    await Promise.all([unauthApi.dispose(), publicChatApi.dispose(), superAdminApi.dispose(), editorApi.dispose()]);
  });

  test.describe('Authentication (401)', () => {
    test('GET /api/chat/conversations returns 401 without auth', async () => {
      const res = await unauthApi.get('/api/chat/conversations');
      expect(res.status()).toBe(401);
    });

    test('POST /api/chat/send returns 401 without auth', async () => {
      const res = await unauthApi.post('/api/chat/send', {
        data: { message: 'hello' },
      });
      expect(res.status()).toBe(401);
    });

    test('DELETE /api/chat/conversations/:id returns 401 without auth', async () => {
      const res = await unauthApi.delete('/api/chat/conversations/00000000-0000-0000-0000-000000000000');
      expect(res.status()).toBe(401);
    });
  });

  test.describe('Validation', () => {
    test('POST /public/api/chat/send rejects empty message', async () => {
      const res = await publicChatApi.post('/public/api/chat/send', {
        data: { message: '' },
      });
      expect(res.status()).toBe(400);
    });

    test('POST /public/api/chat/send rejects missing message field', async () => {
      const res = await publicChatApi.post('/public/api/chat/send', {
        data: {},
      });
      expect(res.status()).toBe(400);
    });

    test('POST /public/api/chat/send rejects invalid conversationId format', async () => {
      const res = await publicChatApi.post('/public/api/chat/send', {
        data: { message: 'hello', conversationId: 'not-a-uuid' },
      });
      expect(res.status()).toBe(400);
    });
  });

  test.describe('Same-origin enforcement', () => {
    test('POST /public/api/chat/send returns 403 without Origin header', async () => {
      const res = await unauthApi.post('/public/api/chat/send', {
        data: { message: 'hello' },
      });
      expect(res.status()).toBe(403);
    });

    test('GET /public/api/chat/conversations/:id returns 403 without Origin header', async () => {
      const res = await unauthApi.get('/public/api/chat/conversations/00000000-0000-0000-0000-000000000000');
      expect(res.status()).toBe(403);
    });
  });

  test.describe('API key rejection', () => {
    test('GET /api/chat/conversations returns 403 with API key auth', async ({}, testInfo) => {
      const baseURL = testInfo.project.use.baseURL as string;

      // Create a real API key via session auth
      const createRes = await superAdminApi.post('/api/api-keys', {
        data: { name: 'Chat test key', scopes: ['changelogs:read'], expiresInDays: 30 },
      });
      const { rawKey, apiKey } = (await createRes.json()).data;

      try {
        // Include Origin so the request passes the same-origin check and reaches the API key guard
        const apiKeyApi = await request.newContext({
          baseURL,
          extraHTTPHeaders: { Authorization: `Bearer ${rawKey}`, Origin: baseURL },
        });
        const res = await apiKeyApi.get('/api/chat/conversations');
        expect(res.status()).toBe(403);

        const body = await res.json();
        expect(body.error).toContain('session authentication');
        await apiKeyApi.dispose();
      } finally {
        // Clean up the API key
        await superAdminApi.delete(`/api/api-keys/${apiKey.id}`);
      }
    });
  });

  test.describe('Conversation CRUD (authenticated)', () => {
    test('GET /api/chat/conversations returns empty list initially', async () => {
      const res = await superAdminApi.get('/api/chat/conversations');
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    test('DELETE /api/chat/conversations/:id returns 404 for non-existent conversation', async () => {
      const res = await superAdminApi.delete('/api/chat/conversations/00000000-0000-0000-0000-000000000000');
      expect(res.status()).toBe(404);
    });
  });

  test.describe('Conversation access control', () => {
    let adminConversationId: string;

    test.beforeAll(async () => {
      // Create an admin conversation owned by the super_admin user
      const prisma = getTestPrismaClient();
      const adminUser = await prisma.user.findFirstOrThrow({
        where: { userRoleAssignments: { some: { role: 'super_admin' } } },
      });

      const conv = await prisma.chatConversation.create({
        data: {
          userId: adminUser.id,
          title: 'Admin test conversation',
          accessLevel: 'admin',
        },
      });
      adminConversationId = conv.id;

      // Add a message to it
      await prisma.chatMessage.create({
        data: {
          conversationId: conv.id,
          role: 'user',
          content: 'Admin-only message',
        },
      });
    });

    test('GET /public/api/chat/conversations/:id blocks unauthenticated access to admin conversations', async () => {
      const res = await publicChatApi.get(`/public/api/chat/conversations/${adminConversationId}`);
      expect(res.status()).toBe(403);
    });

    test('GET /public/api/chat/conversations/:id returns 404 for non-existent conversation', async () => {
      const res = await publicChatApi.get('/public/api/chat/conversations/00000000-0000-0000-0000-000000000000');
      expect(res.status()).toBe(404);
    });

    test('GET /api/chat/conversations/:id allows owner to access admin conversation', async () => {
      const res = await superAdminApi.get(`/api/chat/conversations/${adminConversationId}`);
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.data.id).toBe(adminConversationId);
      expect(body.data.accessLevel).toBe('admin');
    });

    test('GET /api/chat/conversations/:id blocks non-owner from accessing admin conversation', async () => {
      const res = await editorApi.get(`/api/chat/conversations/${adminConversationId}`);
      expect(res.status()).toBe(403);
    });

    test('public endpoint allows reading public conversations', async () => {
      // Create a public conversation
      const prisma = getTestPrismaClient();
      const conv = await prisma.chatConversation.create({
        data: {
          userId: null,
          title: 'Public test conversation',
          accessLevel: 'public',
        },
      });

      await prisma.chatMessage.create({
        data: {
          conversationId: conv.id,
          role: 'user',
          content: 'Public message',
        },
      });

      const res = await publicChatApi.get(`/public/api/chat/conversations/${conv.id}`);
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.data.accessLevel).toBe('public');
    });
  });
});
