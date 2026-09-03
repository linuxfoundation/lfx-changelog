// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { createAuthenticatedContext, createUnauthenticatedContext } from '../../helpers/api.helper.js';

import type { APIRequestContext } from '@playwright/test';

test.describe('Release jobs API', () => {
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

  test('GET /api/releasable-services returns 401 without auth', async () => {
    const res = await unauthApi.get('/api/releasable-services');
    expect(res.status()).toBe(401);
  });

  test('GET /api/releasable-services returns 403 for editor', async () => {
    const res = await editorApi.get('/api/releasable-services');
    expect(res.status()).toBe(403);
  });

  test('POST /api/release-jobs returns 403 for editor', async () => {
    const res = await editorApi.post('/api/release-jobs', {
      data: { serviceKey: 'lfx-self-serve', notes: 'test' },
    });
    expect(res.status()).toBe(403);
  });

  test('POST /api/release-jobs returns 422 for super_admin with missing notes', async () => {
    const catalog = await superAdminApi.get('/api/releasable-services');
    const body = await catalog.json();
    const first = body.data?.[0] as { key?: string } | undefined;
    test.skip(!first?.key, 'Release catalog is empty in this environment; cannot exercise the create endpoint');
    const res = await superAdminApi.post('/api/release-jobs', {
      data: { serviceKey: first?.key, notes: '' },
    });
    expect(res.status()).toBe(422);
  });

  test('GET /api/releasable-services returns 200 for super_admin', async () => {
    const res = await superAdminApi.get('/api/releasable-services');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('plan and confirm stay off /api/releases and do not claim Changelog writes GitOps', async () => {
    const catalog = await superAdminApi.get('/api/releasable-services');
    expect(catalog.status()).toBe(200);
    const releases = await superAdminApi.get('/api/releases');
    expect(releases.status()).toBe(200);
    const body = await catalog.json();
    const first = body.data?.[0] as { key?: string } | undefined;
    test.skip(!first?.key, 'Release catalog is empty in this environment; cannot exercise the plan endpoint');
    const plan = await superAdminApi.get(`/api/releasable-services/${first?.key}/plan`);
    expect([200, 409, 422]).toContain(plan.status());
    if (plan.status() === 200) {
      const planBody = await plan.json();
      const steps = (planBody.data?.steps ?? []) as string[];
      expect(steps.join(' ')).toContain('GitOps version-bump');
      expect(steps.join(' ')).toContain('merge queue');
      expect(steps.join(' ')).not.toContain('Open the signed');
    }
    if (plan.status() === 409) {
      const conflict = await plan.json();
      expect(conflict.data.jobId).toBeTruthy();
    }
  });
});
