// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { ReleaseJobSummarySchema } from '@lfx-changelog/shared';
import { expect, test } from '@playwright/test';
import { z } from 'zod';

import { createApiKeyContext, createAuthenticatedContext, createUnauthenticatedContext } from '../../helpers/api.helper.js';
import { getTestPrismaClient } from '../../helpers/db.helper.js';
import { TEST_FOREIGN_REPOSITORY, TEST_REPOSITORY } from '../../helpers/test-data.js';

import type { APIRequestContext } from '@playwright/test';

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

/** Seeded directly: the webhook path that creates these has its own spec. */
const JOBS = [
  { tagName: 'v1.0.0', status: 'succeeded', conclusion: 'success', attributed: true },
  { tagName: 'v1.1.0', status: 'failed', conclusion: 'cancelled', attributed: false },
];

test.describe('Release jobs API (/api/github/repositories/:repoId/release-jobs)', () => {
  let unauthApi: APIRequestContext;
  let superAdminApi: APIRequestContext;
  let productAdminApi: APIRequestContext;
  let editorApi: APIRequestContext;
  let repositoryId: string;
  let foreignRepositoryId: string;

  test.beforeAll(async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    unauthApi = await createUnauthenticatedContext(baseURL);
    superAdminApi = await createAuthenticatedContext('super_admin', baseURL);
    productAdminApi = await createAuthenticatedContext('product_admin', baseURL);
    editorApi = await createAuthenticatedContext('editor', baseURL);

    const prisma = getTestPrismaClient();
    repositoryId = (await prisma.productRepository.findFirstOrThrow({ where: { fullName: TEST_REPOSITORY.fullName } })).id;
    foreignRepositoryId = (await prisma.productRepository.findFirstOrThrow({ where: { fullName: TEST_FOREIGN_REPOSITORY.fullName } })).id;

    const service = await prisma.releasableService.findFirstOrThrow({ where: { repositoryId } });
    const user = await prisma.user.findFirstOrThrow({ where: { email: { contains: '@' } } });

    for (const [index, job] of JOBS.entries()) {
      await prisma.releaseJob.create({
        data: {
          releasableServiceId: service.id,
          tagName: job.tagName,
          status: job.status as 'succeeded' | 'failed',
          conclusion: job.conclusion,
          workflowName: 'Docker Build - Release',
          workflowRunUrl: `https://github.com/${TEST_REPOSITORY.fullName}/actions/runs/${9_000_000 + index}`,
          workflowRunId: String(9_000_000 + index),
          requestedById: job.attributed ? user.id : null,
          steps: [{ jobId: 1, attempt: 1, name: 'build-and-push', status: 'completed', conclusion: 'success', startedAt: null, completedAt: null }],
        },
      });
    }
  });

  test.afterAll(async () => {
    await getTestPrismaClient().releaseJob.deleteMany({ where: { tagName: { in: JOBS.map((job) => job.tagName) } } });
    await Promise.all([unauthApi.dispose(), superAdminApi.dispose(), productAdminApi.dispose(), editorApi.dispose()]);
  });

  test.describe('Authentication (401)', () => {
    test('returns 401 without auth', async () => {
      const res = await unauthApi.get(`/api/github/repositories/${repositoryId}/release-jobs`);
      expect(res.status()).toBe(401);
      expect((await res.json()).code).toBe('AUTHENTICATION_REQUIRED');
    });
  });

  test.describe('Authorization', () => {
    test('an API key is rejected on this session-only endpoint', async ({}, testInfo) => {
      const baseURL = testInfo.project.use.baseURL as string;
      const created = await superAdminApi.post('/api/api-keys', { data: { name: 'release-jobs-oauth-only', scopes: ['products:read'], expiresInDays: 30 } });
      expect(created.status()).toBe(201);
      const { rawKey, apiKey } = (await created.json()).data;

      const keyCtx = await createApiKeyContext(rawKey, baseURL);
      try {
        const res = await keyCtx.get(`/api/github/repositories/${repositoryId}/release-jobs`);
        expect(res.status()).toBe(403);
      } finally {
        await keyCtx.dispose();
        await superAdminApi.delete(`/api/api-keys/${apiKey.id}`);
      }
    });

    test('an editor is refused', async () => {
      expect((await editorApi.get(`/api/github/repositories/${repositoryId}/release-jobs`)).status()).toBe(403);
    });

    test("a repository outside the caller's products is 404, not 403", async () => {
      // 403 would confirm the repository exists; these endpoints must not enumerate.
      const res = await productAdminApi.get(`/api/github/repositories/${foreignRepositoryId}/release-jobs`);
      expect(res.status()).toBe(404);
    });

    test('an unknown repository is 404', async () => {
      expect((await superAdminApi.get(`/api/github/repositories/${MISSING_ID}/release-jobs`)).status()).toBe(404);
    });
  });

  test.describe('Listing', () => {
    test('returns every job for the repository, newest first, in the published shape', async () => {
      const res = await productAdminApi.get(`/api/github/repositories/${repositoryId}/release-jobs`);
      expect(res.status()).toBe(200);

      const jobs = z.array(ReleaseJobSummarySchema).parse((await res.json()).data);
      expect(jobs.map((job) => job.tagName)).toEqual(['v1.1.0', 'v1.0.0']);

      const succeeded = jobs.find((job) => job.tagName === 'v1.0.0');
      expect(succeeded).toMatchObject({ status: 'succeeded', conclusion: 'success', workflowName: 'Docker Build - Release' });
      expect(succeeded!.workflowRunUrl).toContain('/actions/runs/');
      expect(succeeded!.steps).toHaveLength(1);

      // GitHub's own word is kept even where the four states collapse it to a failure.
      expect(jobs.find((job) => job.tagName === 'v1.1.0')).toMatchObject({ status: 'failed', conclusion: 'cancelled' });
    });

    test('says who published from Changelog, and nothing for a tag pushed straight to GitHub', async () => {
      const jobs = z
        .array(ReleaseJobSummarySchema)
        .parse((await (await productAdminApi.get(`/api/github/repositories/${repositoryId}/release-jobs`)).json()).data);

      expect(jobs.find((job) => job.tagName === 'v1.0.0')!.requestedBy).toBeTruthy();
      expect(jobs.find((job) => job.tagName === 'v1.1.0')!.requestedBy).toBeNull();
    });

    test('a repository with no releasable service has no jobs rather than an error', async () => {
      // Every seeded repository is releasable, so this one is made here: most tracked
      // repositories are documentation or libraries and must not error on this route.
      const prisma = getTestPrismaClient();
      const product = await prisma.product.findUniqueOrThrow({ where: { slug: 'e2e-easycla' } });
      const plain = await prisma.productRepository.create({
        data: {
          productId: product.id,
          githubInstallationId: TEST_REPOSITORY.githubInstallationId,
          owner: TEST_REPOSITORY.owner,
          name: 'e2e-docs-only-repo',
          fullName: 'linuxfoundation/e2e-docs-only-repo',
          htmlUrl: 'https://github.com/linuxfoundation/e2e-docs-only-repo',
        },
      });

      try {
        const res = await superAdminApi.get(`/api/github/repositories/${plain.id}/release-jobs`);
        expect(res.status()).toBe(200);
        expect((await res.json()).data).toEqual([]);
      } finally {
        await prisma.productRepository.delete({ where: { id: plain.id } });
      }
    });
  });
});
