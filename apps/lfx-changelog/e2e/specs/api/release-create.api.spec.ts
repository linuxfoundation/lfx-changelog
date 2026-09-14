// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { createAuthenticatedContext, createUnauthenticatedContext } from '../../helpers/api.helper.js';

import type { APIRequestContext } from '@playwright/test';

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Covers the contract only. Creating a release calls GitHub, which the E2E environment has no
 * credentials for, so the success path is not exercised here.
 */
test.describe('Release creation API (/api/releases/repositories)', () => {
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
    test('GET target requires auth', async () => {
      const res = await unauthApi.get(`/api/releases/repositories/${MISSING_ID}/target`);
      expect(res.status()).toBe(401);
    });

    test('POST notes requires auth', async () => {
      const res = await unauthApi.post(`/api/releases/repositories/${MISSING_ID}/notes`, { data: { tagName: 'v1.0.0', targetCommitish: 'main' } });
      expect(res.status()).toBe(401);
    });

    test('POST release requires auth', async () => {
      const res = await unauthApi.post(`/api/releases/repositories/${MISSING_ID}`, {
        data: { tagName: 'v1.0.0', targetCommitish: 'main', name: 'v1.0.0', body: 'notes' },
      });
      expect(res.status()).toBe(401);
    });
  });

  test.describe('Authorization (403)', () => {
    test('an editor cannot read release targets', async () => {
      const res = await editorApi.get(`/api/releases/repositories/${MISSING_ID}/target`);
      expect(res.status()).toBe(403);
    });

    test('an editor cannot publish a release', async () => {
      const res = await editorApi.post(`/api/releases/repositories/${MISSING_ID}`, {
        data: { tagName: 'v1.0.0', targetCommitish: 'main', name: 'v1.0.0', body: 'notes' },
      });
      expect(res.status()).toBe(403);
    });
  });

  test.describe('Validation (400)', () => {
    test('rejects a release with no tag', async () => {
      const res = await superAdminApi.post(`/api/releases/repositories/${MISSING_ID}`, {
        data: { targetCommitish: 'main', name: 'v1.0.0', body: 'notes' },
      });
      expect(res.status()).toBe(400);
      expect((await res.json()).code).toBe('VALIDATION_ERROR');
    });

    test('rejects a blank tag', async () => {
      const res = await superAdminApi.post(`/api/releases/repositories/${MISSING_ID}`, {
        data: { tagName: '   ', targetCommitish: 'main', name: 'v1.0.0', body: 'notes' },
      });
      expect(res.status()).toBe(400);
    });

    test('rejects a release with no target', async () => {
      const res = await superAdminApi.post(`/api/releases/repositories/${MISSING_ID}`, {
        data: { tagName: 'v1.0.0', name: 'v1.0.0', body: 'notes' },
      });
      expect(res.status()).toBe(400);
    });

    test('rejects a notes preview with no target', async () => {
      const res = await superAdminApi.post(`/api/releases/repositories/${MISSING_ID}/notes`, { data: { tagName: 'v1.0.0' } });
      expect(res.status()).toBe(400);
    });
  });

  test.describe('Not found (404)', () => {
    test('an unknown repository is not found, and validation runs first', async () => {
      const res = await superAdminApi.post(`/api/releases/repositories/${MISSING_ID}`, {
        data: { tagName: 'v1.0.0', targetCommitish: 'main', name: 'v1.0.0', body: 'notes' },
      });
      expect(res.status()).toBe(404);
      expect((await res.json()).code).toBe('NOT_FOUND');
    });

    test('an unknown repository has no release target', async () => {
      const res = await superAdminApi.get(`/api/releases/repositories/${MISSING_ID}/target`);
      expect(res.status()).toBe(404);
    });
  });
});
