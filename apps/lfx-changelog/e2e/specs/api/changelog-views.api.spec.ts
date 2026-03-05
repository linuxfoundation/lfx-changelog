// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { createAuthenticatedContext, createUnauthenticatedContext } from '../../helpers/api.helper.js';

import type { APIRequestContext } from '@playwright/test';

test.describe('Changelog Views API (/api/changelog-views)', () => {
  let unauthApi: APIRequestContext;
  let superAdminApi: APIRequestContext;
  let editorApi: APIRequestContext;
  let userApi: APIRequestContext;

  let easyclaProductId: string;
  let securityProductId: string;
  let insightsProductId: string;

  test.beforeAll(async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    unauthApi = await createUnauthenticatedContext(baseURL);
    superAdminApi = await createAuthenticatedContext('super_admin', baseURL);
    editorApi = await createAuthenticatedContext('editor', baseURL);
    userApi = await createAuthenticatedContext('user', baseURL);

    // Discover product IDs from seeded data
    const productsRes = await superAdminApi.get('/api/products');
    const products = (await productsRes.json()).data;
    easyclaProductId = products.find((p: any) => p.slug === 'e2e-easycla').id;
    securityProductId = products.find((p: any) => p.slug === 'e2e-security').id;
    insightsProductId = products.find((p: any) => p.slug === 'e2e-insights').id;
  });

  test.afterAll(async () => {
    await Promise.all([unauthApi.dispose(), superAdminApi.dispose(), editorApi.dispose(), userApi.dispose()]);
  });

  test.describe('Authentication (401)', () => {
    test('GET /api/changelog-views/unseen returns 401 without auth', async () => {
      const res = await unauthApi.get('/api/changelog-views/unseen');
      expect(res.status()).toBe(401);
    });

    test('POST /api/changelog-views/mark-viewed returns 401 without auth', async () => {
      const res = await unauthApi.post('/api/changelog-views/mark-viewed', {
        data: { productId: easyclaProductId },
      });
      expect(res.status()).toBe(401);
    });
  });

  test.describe('Authorization (RBAC)', () => {
    test('user with no roles can GET unseen counts (any authenticated user)', async () => {
      // changelog-views only requires CHANGELOGS_READ scope, no role restriction
      // but OAuth users without roles should still be able to access since
      // authorize only checks scope for API key auth
      const res = await userApi.get('/api/changelog-views/unseen');
      expect(res.status()).toBe(200);
    });

    test('editor can GET unseen counts', async () => {
      const res = await editorApi.get('/api/changelog-views/unseen');
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    test('user with no roles can POST mark-viewed', async () => {
      const res = await userApi.post('/api/changelog-views/mark-viewed', {
        data: { productId: easyclaProductId },
      });
      expect(res.status()).toBe(200);
    });
  });

  test.describe('GET /api/changelog-views/unseen', () => {
    test('returns counts for all products when no filter specified', async () => {
      const res = await superAdminApi.get('/api/changelog-views/unseen');
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(3);

      // Each item should have the expected shape
      for (const item of body.data) {
        expect(item).toHaveProperty('productId');
        expect(item).toHaveProperty('unseenCount');
        expect(item).toHaveProperty('lastViewedAt');
        expect(typeof item.unseenCount).toBe('number');
        expect(item.unseenCount).toBeGreaterThanOrEqual(0);
      }
    });

    test('returns single object when productId is specified', async () => {
      const res = await superAdminApi.get(`/api/changelog-views/unseen?productId=${easyclaProductId}`);
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.productId).toBe(easyclaProductId);
      expect(typeof body.data.unseenCount).toBe('number');
      expect(body.data).toHaveProperty('lastViewedAt');
    });

    test('returns array when productIds is specified', async () => {
      const res = await superAdminApi.get(`/api/changelog-views/unseen?productIds=${easyclaProductId},${securityProductId}`);
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(2);

      const productIds = body.data.map((d: any) => d.productId);
      expect(productIds).toContain(easyclaProductId);
      expect(productIds).toContain(securityProductId);
    });

    test('first-time viewer has null lastViewedAt and sees all published as unseen', async () => {
      // Use editor context which likely hasn't marked any views
      const res = await editorApi.get(`/api/changelog-views/unseen?productId=${insightsProductId}`);
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.data.lastViewedAt).toBeNull();
      // Insights has 1 seeded published changelog
      expect(body.data.unseenCount).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('POST /api/changelog-views/mark-viewed', () => {
    test('marks a single product as viewed with productId', async () => {
      const res = await superAdminApi.post('/api/changelog-views/mark-viewed', {
        data: { productId: easyclaProductId },
      });
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.productId).toBe(easyclaProductId);
      expect(body.data.lastViewedAt).toBeDefined();
      expect(typeof body.data.lastViewedAt).toBe('string');
    });

    test('marks multiple products as viewed with productIds', async () => {
      const res = await superAdminApi.post('/api/changelog-views/mark-viewed', {
        data: { productIds: [easyclaProductId, securityProductId] },
      });
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(2);

      const productIds = body.data.map((d: any) => d.productId);
      expect(productIds).toContain(easyclaProductId);
      expect(productIds).toContain(securityProductId);

      for (const item of body.data) {
        expect(item.lastViewedAt).toBeDefined();
        expect(typeof item.lastViewedAt).toBe('string');
      }
    });

    test('after marking viewed, unseen count drops to 0', async () => {
      // Mark viewed
      await superAdminApi.post('/api/changelog-views/mark-viewed', {
        data: { productId: securityProductId },
      });

      // Check unseen count
      const res = await superAdminApi.get(`/api/changelog-views/unseen?productId=${securityProductId}`);
      const body = await res.json();
      expect(body.data.unseenCount).toBe(0);
      expect(body.data.lastViewedAt).not.toBeNull();
    });

    test('mark-viewed is idempotent (calling twice succeeds)', async () => {
      const first = await superAdminApi.post('/api/changelog-views/mark-viewed', {
        data: { productId: insightsProductId },
      });
      expect(first.status()).toBe(200);

      const second = await superAdminApi.post('/api/changelog-views/mark-viewed', {
        data: { productId: insightsProductId },
      });
      expect(second.status()).toBe(200);

      // Second call should return a later or equal timestamp
      const firstTime = (await first.json()).data.lastViewedAt;
      const secondTime = (await second.json()).data.lastViewedAt;
      expect(new Date(secondTime).getTime()).toBeGreaterThanOrEqual(new Date(firstTime).getTime());
    });
  });

  test.describe('Validation', () => {
    test('POST with empty body returns 400', async () => {
      const res = await superAdminApi.post('/api/changelog-views/mark-viewed', {
        data: {},
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    test('POST with invalid UUID returns 400', async () => {
      const res = await superAdminApi.post('/api/changelog-views/mark-viewed', {
        data: { productId: 'not-a-uuid' },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    test('POST with invalid productIds array returns 400', async () => {
      const res = await superAdminApi.post('/api/changelog-views/mark-viewed', {
        data: { productIds: ['not-a-uuid'] },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  test.describe('Full Lifecycle', () => {
    test('unseen count increases when a new changelog is published', async () => {
      // Mark viewed to reset count
      await editorApi.post('/api/changelog-views/mark-viewed', {
        data: { productId: easyclaProductId },
      });

      // Verify count is 0
      const beforeRes = await editorApi.get(`/api/changelog-views/unseen?productId=${easyclaProductId}`);
      expect((await beforeRes.json()).data.unseenCount).toBe(0);

      // Create and publish a new changelog
      const createRes = await superAdminApi.post('/api/changelogs', {
        data: {
          productId: easyclaProductId,
          title: 'E2E: Changelog View Lifecycle Test',
          description: 'Testing unseen count lifecycle.',
          version: '99.0.0',
          status: 'draft',
        },
      });
      const entryId = (await createRes.json()).data.id;
      await superAdminApi.patch(`/api/changelogs/${entryId}/publish`);

      // Verify unseen count increased
      const afterRes = await editorApi.get(`/api/changelog-views/unseen?productId=${easyclaProductId}`);
      expect((await afterRes.json()).data.unseenCount).toBeGreaterThanOrEqual(1);

      // Mark viewed again
      await editorApi.post('/api/changelog-views/mark-viewed', {
        data: { productId: easyclaProductId },
      });

      // Verify count is back to 0
      const finalRes = await editorApi.get(`/api/changelog-views/unseen?productId=${easyclaProductId}`);
      expect((await finalRes.json()).data.unseenCount).toBe(0);

      // Cleanup
      await superAdminApi.delete(`/api/changelogs/${entryId}`);
    });
  });
});
