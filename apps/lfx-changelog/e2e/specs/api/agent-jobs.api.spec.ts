// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { createAuthenticatedContext, createUnauthenticatedContext } from '../../helpers/api.helper.js';
import { TEST_PRODUCTS } from '../../helpers/test-data.js';

import type { APIRequestContext } from '@playwright/test';

test.describe('Agent Jobs API (/api/agent-jobs)', () => {
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
    test('GET /api/agent-jobs returns 401 without auth', async () => {
      const res = await unauthApi.get('/api/agent-jobs');
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('GET /api/agent-jobs/:id returns 401 without auth', async () => {
      const res = await unauthApi.get('/api/agent-jobs/00000000-0000-0000-0000-000000000000');
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('POST /api/agent-jobs/trigger/:productId returns 401 without auth', async () => {
      const res = await unauthApi.post('/api/agent-jobs/trigger/00000000-0000-0000-0000-000000000000');
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('AUTHENTICATION_REQUIRED');
    });
  });

  test.describe('Authorization (403 — SUPER_ADMIN required)', () => {
    test('GET /api/agent-jobs returns 403 for editor role', async () => {
      const res = await editorApi.get('/api/agent-jobs');
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('AUTHORIZATION_REQUIRED');
    });

    test('POST /api/agent-jobs/trigger/:productId returns 403 for editor role', async () => {
      const res = await editorApi.post('/api/agent-jobs/trigger/00000000-0000-0000-0000-000000000000');
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('AUTHORIZATION_REQUIRED');
    });
  });

  test.describe('GET /api/agent-jobs (list)', () => {
    test('returns 200 with paginated response shape', async () => {
      const res = await superAdminApi.get('/api/agent-jobs');
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('total');
      expect(body).toHaveProperty('page');
      expect(body).toHaveProperty('pageSize');
      expect(body).toHaveProperty('totalPages');
      expect(Array.isArray(body.data)).toBe(true);
      expect(typeof body.total).toBe('number');
      expect(typeof body.page).toBe('number');
      expect(typeof body.pageSize).toBe('number');
      expect(typeof body.totalPages).toBe('number');
    });

    test('supports ?status= filter', async () => {
      const res = await superAdminApi.get('/api/agent-jobs?status=completed');
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      for (const job of body.data) {
        expect(job.status).toBe('completed');
      }
    });

    test('supports ?productId= filter', async () => {
      // First get a product ID from the list
      const productsRes = await superAdminApi.get('/api/products');
      const products = (await productsRes.json()).data;
      const product = products.find((p: any) => p.slug === TEST_PRODUCTS[0]!.slug);

      if (product) {
        const res = await superAdminApi.get(`/api/agent-jobs?productId=${product.id}`);
        expect(res.status()).toBe(200);

        const body = await res.json();
        expect(body.success).toBe(true);
        for (const job of body.data) {
          expect(job.productId).toBe(product.id);
        }
      }
    });
  });

  test.describe('GET /api/agent-jobs/:id (detail)', () => {
    test('returns 404 for non-existent job ID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await superAdminApi.get(`/api/agent-jobs/${fakeId}`);
      expect(res.status()).toBe(404);

      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });
  });

  test.describe('POST /api/agent-jobs/trigger/:productId', () => {
    test('returns 404 for non-existent product ID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await superAdminApi.post(`/api/agent-jobs/trigger/${fakeId}`);
      expect(res.status()).toBe(404);

      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });

    test('returns 202 for valid product and job appears in detail', async () => {
      // Get a real product ID
      const productsRes = await superAdminApi.get('/api/products');
      const products = (await productsRes.json()).data;
      const product = products.find((p: any) => p.slug === TEST_PRODUCTS[0]!.slug);
      expect(product).toBeDefined();

      // Trigger the agent — this creates a job but the agent runs async in the background
      const triggerRes = await superAdminApi.post(`/api/agent-jobs/trigger/${product.id}`);
      expect(triggerRes.status()).toBe(202);

      const triggerBody = await triggerRes.json();
      expect(triggerBody.success).toBe(true);
      expect(triggerBody.data).toHaveProperty('jobId');
      expect(typeof triggerBody.data.jobId).toBe('string');

      const jobId = triggerBody.data.jobId;

      // Verify the job record was created (does NOT wait for agent completion)
      const detailRes = await superAdminApi.get(`/api/agent-jobs/${jobId}`);
      expect(detailRes.status()).toBe(200);

      const detailBody = await detailRes.json();
      expect(detailBody.success).toBe(true);
      expect(detailBody.data.id).toBe(jobId);
      expect(detailBody.data.productId).toBe(product.id);
      expect(detailBody.data.trigger).toBe('manual');
      expect(['pending', 'running', 'completed', 'failed']).toContain(detailBody.data.status);
      expect(detailBody.data).toHaveProperty('progressLog');
      expect(detailBody.data).toHaveProperty('createdAt');
    });

    // Skipped by default — this test runs a full agent pipeline (costly: ~3 min, uses API tokens).
    // Enable manually for smoke testing: remove `.skip` or run with AGENT_SMOKE_TEST=1
    test.skip('triggered job eventually reaches a terminal status', async () => {
      const productsRes = await superAdminApi.get('/api/products');
      const products = (await productsRes.json()).data;
      const product = products.find((p: any) => p.slug === TEST_PRODUCTS[0]!.slug);
      expect(product).toBeDefined();

      const triggerRes = await superAdminApi.post(`/api/agent-jobs/trigger/${product.id}`);
      expect(triggerRes.status()).toBe(202);
      const jobId = (await triggerRes.json()).data.jobId;

      // Poll until the job reaches a terminal status (max 4 minutes)
      const maxWaitMs = 240_000;
      const pollIntervalMs = 5_000;
      const deadline = Date.now() + maxWaitMs;
      let finalStatus = '';

      while (Date.now() < deadline) {
        const res = await superAdminApi.get(`/api/agent-jobs/${jobId}`);
        const body = await res.json();
        finalStatus = body.data.status;

        if (finalStatus === 'completed' || finalStatus === 'failed') {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }

      expect(['completed', 'failed']).toContain(finalStatus);
    });
  });
});
