// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { createAuthenticatedContext, createUnauthenticatedContext } from '../../helpers/api.helper.js';

import type { APIRequestContext } from '@playwright/test';

test.describe('Blog Agent API (/api/agent-jobs/trigger-blog)', () => {
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
    test('POST /api/agent-jobs/trigger-blog/monthly returns 401 without auth', async () => {
      const res = await unauthApi.post('/api/agent-jobs/trigger-blog/monthly');
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('AUTHENTICATION_REQUIRED');
    });
  });

  test.describe('Authorization (403 — SUPER_ADMIN required)', () => {
    test('POST /api/agent-jobs/trigger-blog/monthly returns 403 for editor role', async () => {
      const res = await editorApi.post('/api/agent-jobs/trigger-blog/monthly');
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('AUTHORIZATION_REQUIRED');
    });
  });

  test.describe('Input Validation', () => {
    test('returns 400 for unsupported blog trigger type', async () => {
      const res = await superAdminApi.post('/api/agent-jobs/trigger-blog/weekly');
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Invalid blog trigger type');
    });

    test('returns 400 when only year is provided without month', async () => {
      const res = await superAdminApi.post('/api/agent-jobs/trigger-blog/monthly?year=2025');
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Both year and month must be provided together');
    });

    test('returns 400 when only month is provided without year', async () => {
      const res = await superAdminApi.post('/api/agent-jobs/trigger-blog/monthly?month=6');
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Both year and month must be provided together');
    });

    test('returns 400 for out-of-range month (0)', async () => {
      const res = await superAdminApi.post('/api/agent-jobs/trigger-blog/monthly?year=2025&month=0');
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Invalid year or month');
    });

    test('returns 400 for out-of-range month (13)', async () => {
      const res = await superAdminApi.post('/api/agent-jobs/trigger-blog/monthly?year=2025&month=13');
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Invalid year or month');
    });

    test('returns 400 for out-of-range year (2019)', async () => {
      const res = await superAdminApi.post('/api/agent-jobs/trigger-blog/monthly?year=2019&month=6');
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Invalid year or month');
    });
  });

  test.describe('Trigger and Job Lifecycle', () => {
    // Use a far-future period that won't collide with seeded data
    const testYear = 2099;
    const testMonth = 12;

    test('returns 202 and creates a blog agent job with nullable productId', async () => {
      const triggerRes = await superAdminApi.post(`/api/agent-jobs/trigger-blog/monthly?year=${testYear}&month=${testMonth}`);
      // May return 202 (job created) or 502 (if AI env vars missing) — both are valid outcomes
      if (triggerRes.status() === 502) {
        // AI env vars not configured in test env — skip the rest
        test.skip();
        return;
      }
      expect(triggerRes.status()).toBe(202);

      const triggerBody = await triggerRes.json();
      expect(triggerBody.success).toBe(true);
      expect(triggerBody.data).toHaveProperty('jobId');
      expect(typeof triggerBody.data.jobId).toBe('string');

      const jobId = triggerBody.data.jobId;

      // Verify job record was created
      const detailRes = await superAdminApi.get(`/api/agent-jobs/${jobId}`);
      expect(detailRes.status()).toBe(200);

      const detailBody = await detailRes.json();
      expect(detailBody.success).toBe(true);
      expect(detailBody.data.id).toBe(jobId);
      // Blog agent jobs have null productId (not tied to a specific product)
      expect(detailBody.data.productId).toBeNull();
      expect(detailBody.data.trigger).toBe('newsletter_monthly');
      expect(['pending', 'running', 'completed', 'failed']).toContain(detailBody.data.status);
      expect(detailBody.data).toHaveProperty('progressLog');
      expect(detailBody.data).toHaveProperty('createdAt');

      // Cancel the job to prevent it running indefinitely
      const cancelRes = await superAdminApi.post(`/api/agent-jobs/${jobId}/cancel`);
      expect([200, 400]).toContain(cancelRes.status()); // 400 if already terminal
    });

    test('job appears in list with trigger=newsletter_monthly', async () => {
      const triggerRes = await superAdminApi.post(`/api/agent-jobs/trigger-blog/monthly?year=${testYear}&month=${testMonth - 1}`);
      if (triggerRes.status() === 502) {
        test.skip();
        return;
      }
      expect(triggerRes.status()).toBe(202);
      const jobId = (await triggerRes.json()).data.jobId;

      // List all jobs and find ours
      const listRes = await superAdminApi.get('/api/agent-jobs');
      expect(listRes.status()).toBe(200);

      const listBody = await listRes.json();
      const blogJob = listBody.data.find((j: any) => j.id === jobId);
      expect(blogJob).toBeDefined();
      expect(blogJob.productId).toBeNull();
      expect(blogJob.product).toBeNull();

      // Clean up
      await superAdminApi.post(`/api/agent-jobs/${jobId}/cancel`);
    });

    test('cancel a blog agent job returns 200', async () => {
      const triggerRes = await superAdminApi.post(`/api/agent-jobs/trigger-blog/monthly?year=${testYear}&month=${testMonth - 2}`);
      if (triggerRes.status() === 502) {
        test.skip();
        return;
      }
      expect(triggerRes.status()).toBe(202);
      const jobId = (await triggerRes.json()).data.jobId;

      // Cancel
      const cancelRes = await superAdminApi.post(`/api/agent-jobs/${jobId}/cancel`);
      // May be 200 (cancelled) or 400 (already terminal if it completed fast)
      if (cancelRes.status() === 200) {
        const cancelBody = await cancelRes.json();
        expect(cancelBody.success).toBe(true);

        // Verify status is now cancelled
        const detailRes = await superAdminApi.get(`/api/agent-jobs/${jobId}`);
        const detail = await detailRes.json();
        expect(detail.data.status).toBe('cancelled');
      }
    });

    test('cancel already-terminal blog job returns 400', async () => {
      const triggerRes = await superAdminApi.post(`/api/agent-jobs/trigger-blog/monthly?year=${testYear}&month=${testMonth - 3}`);
      if (triggerRes.status() === 502) {
        test.skip();
        return;
      }
      expect(triggerRes.status()).toBe(202);
      const jobId = (await triggerRes.json()).data.jobId;

      // Cancel once
      await superAdminApi.post(`/api/agent-jobs/${jobId}/cancel`);

      // Try to cancel again — should be 400 (already terminal)
      const secondCancel = await superAdminApi.post(`/api/agent-jobs/${jobId}/cancel`);
      expect(secondCancel.status()).toBe(400);
      const body = await secondCancel.json();
      expect(body.error).toContain('Only pending or running jobs can be cancelled');
    });

    test('cancel non-existent job returns 404', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await superAdminApi.post(`/api/agent-jobs/${fakeId}/cancel`);
      expect(res.status()).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });
  });

  test.describe('Defaults to Previous Month', () => {
    test('trigger without year/month params defaults to previous month and returns 202', async () => {
      const triggerRes = await superAdminApi.post('/api/agent-jobs/trigger-blog/monthly');
      // The seeded data has a published January 2026 roundup — if the previous month is January
      // this will return 502 (already published). In all other cases, 202 or 502 (missing AI keys).
      expect([202, 502]).toContain(triggerRes.status());

      if (triggerRes.status() === 202) {
        const jobId = (await triggerRes.json()).data.jobId;
        // Clean up
        await superAdminApi.post(`/api/agent-jobs/${jobId}/cancel`);
      }
    });
  });

  test.describe('Duplicate Job Prevention', () => {
    const dupeYear = 2098;
    const dupeMonth = 6;

    test('triggering while another blog job is active returns 502', async () => {
      // Trigger the first job
      const firstRes = await superAdminApi.post(`/api/agent-jobs/trigger-blog/monthly?year=${dupeYear}&month=${dupeMonth}`);
      if (firstRes.status() === 502) {
        // AI env vars not configured or other error — skip
        test.skip();
        return;
      }
      expect(firstRes.status()).toBe(202);
      const firstJobId = (await firstRes.json()).data.jobId;

      // Trigger a second job immediately — should be rejected since one is already active
      const secondRes = await superAdminApi.post(`/api/agent-jobs/trigger-blog/monthly?year=${dupeYear}&month=${dupeMonth + 1}`);
      expect(secondRes.status()).toBe(502);
      const body = await secondRes.json();
      expect(body.message).toContain('already running');

      // Clean up
      await superAdminApi.post(`/api/agent-jobs/${firstJobId}/cancel`);
    });
  });

  test.describe('Blog Relation in Job Detail', () => {
    test('job detail includes blog relation field', async () => {
      const triggerRes = await superAdminApi.post('/api/agent-jobs/trigger-blog/monthly?year=2097&month=1');
      if (triggerRes.status() === 502) {
        test.skip();
        return;
      }
      expect(triggerRes.status()).toBe(202);
      const jobId = (await triggerRes.json()).data.jobId;

      const detailRes = await superAdminApi.get(`/api/agent-jobs/${jobId}`);
      expect(detailRes.status()).toBe(200);

      const detail = await detailRes.json();
      // Blog relation is included in the query (may be null if agent hasn't created one yet)
      expect(detail.data).toHaveProperty('blog');

      // Clean up
      await superAdminApi.post(`/api/agent-jobs/${jobId}/cancel`);
    });
  });
});
