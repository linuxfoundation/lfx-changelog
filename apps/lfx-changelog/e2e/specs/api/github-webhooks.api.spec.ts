// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { ReleaseJobStepSchema } from '@lfx-changelog/shared';
import { expect, test } from '@playwright/test';
import crypto from 'node:crypto';
import { z } from 'zod';

import { createUnauthenticatedContext } from '../../helpers/api.helper.js';
import { getTestPrismaClient } from '../../helpers/db.helper.js';
import { TEST_FOREIGN_REPOSITORY, TEST_REPOSITORY, TEST_RETIRED_REPOSITORY } from '../../helpers/test-data.js';

import type { APIRequestContext, APIResponse } from '@playwright/test';

const WEBHOOK_SECRET = process.env['GITHUB_WEBHOOK_SECRET'] || '';

/** Run ids are globally unique on GitHub, and the lookups key on them, so each case claims its own. */
let nextRunId = 4_100_000_000;

/** Long enough for a job the controller must not create to have been created. */
const AGENT_SETTLE_MS = 2_000;

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, AGENT_SETTLE_MS));
}

type WorkflowRunOverrides = {
  headBranch?: string | null;
  status?: string;
  conclusion?: string | null;
  runId?: number;
  updatedAt?: string;
};

function workflowRunBody(fullName: string, overrides: WorkflowRunOverrides = {}): Record<string, unknown> {
  const status = overrides.status ?? 'completed';
  const runId = overrides.runId ?? nextRunId++;

  return {
    action: status === 'completed' ? 'completed' : 'in_progress',
    repository: { full_name: fullName, default_branch: 'main' },
    workflow_run: {
      id: runId,
      name: 'Docker Build - Release',
      head_branch: overrides.headBranch === undefined ? 'v1.1.0' : overrides.headBranch,
      status,
      conclusion: overrides.conclusion === undefined ? 'success' : overrides.conclusion,
      html_url: `https://github.com/${fullName}/actions/runs/${runId}`,
      run_started_at: '2026-09-18T10:00:00Z',
      updated_at: overrides.updatedAt ?? '2026-09-18T10:06:00Z',
    },
  };
}

let nextReleaseId = 970_000;

/**
 * Tags this spec publishes into the shared fixture repository. They are removed again afterwards:
 * left behind, they would become the newest stored tag and change what other specs read.
 */
const PUBLISHED_TAGS = ['v2.0.0', 'v2.1.0-draft', 'v2.2.0', 'v2.3.0', 'v3.0.0', 'v4.0.0', 'v4.1.0', 'v5.0.0'];

function releaseBody(fullName: string, tagName: string, overrides: { action?: string; draft?: boolean } = {}): Record<string, unknown> {
  return {
    action: overrides.action ?? 'published',
    repository: { full_name: fullName, default_branch: 'main' },
    release: {
      id: nextReleaseId++,
      tag_name: tagName,
      name: tagName,
      html_url: `https://github.com/${fullName}/releases/tag/${tagName}`,
      body: null,
      draft: overrides.draft ?? false,
      prerelease: false,
      published_at: '2026-09-18T09:59:00Z',
      author: { login: 'lfx-changelog[bot]', avatar_url: 'https://avatars.githubusercontent.com/u/1' },
    },
  };
}

test.describe('GitHub webhooks API (/webhooks/github)', () => {
  let api: APIRequestContext;

  /** Signs the exact bytes sent, the way the middleware verifies them. */
  async function send(event: string, body: Record<string, unknown>, secret = WEBHOOK_SECRET): Promise<APIResponse> {
    const raw = JSON.stringify(body);
    const signature = `sha256=${crypto.createHmac('sha256', secret).update(raw).digest('hex')}`;

    return api.post('/webhooks/github', {
      data: raw,
      headers: { 'content-type': 'application/json', 'x-github-event': event, 'x-hub-signature-256': signature },
    });
  }

  async function jobFor(tagName: string) {
    return getTestPrismaClient().releaseJob.findFirst({
      where: { tagName, releasableService: { repository: { fullName: TEST_REPOSITORY.fullName } } },
    });
  }

  test.beforeAll(async ({}, testInfo) => {
    // The suite cannot sign anything without this, and an empty secret makes the server 500 —
    // fail here with the cause rather than leaving every case to guess at a 401.
    expect(WEBHOOK_SECRET, 'GITHUB_WEBHOOK_SECRET must be set for the webhook suite — see .env.e2e.example').toBeTruthy();

    api = await createUnauthenticatedContext(testInfo.project.use.baseURL as string);
  });

  test.afterAll(async () => {
    const prisma = getTestPrismaClient();
    await prisma.releaseJob.deleteMany();
    await prisma.gitHubRelease.deleteMany({ where: { tagName: { in: PUBLISHED_TAGS } } });
    await api.dispose();
  });

  test.describe('Signature verification', () => {
    test('a payload signed with the wrong secret is rejected', async () => {
      const res = await send('workflow_run', workflowRunBody(TEST_REPOSITORY.fullName), 'not-the-secret');

      expect(res.status()).toBe(401);
      expect((await res.json()).error).toBe('Invalid signature');
    });

    test('a payload with no signature header is rejected', async () => {
      const res = await api.post('/webhooks/github', {
        data: JSON.stringify(workflowRunBody(TEST_REPOSITORY.fullName)),
        headers: { 'content-type': 'application/json', 'x-github-event': 'workflow_run' },
      });

      expect(res.status()).toBe(401);
      expect((await res.json()).error).toBe('Missing signature');
    });
  });

  test.describe('Event filtering', () => {
    test('an action outside the recorded set is ignored', async () => {
      const body = { ...workflowRunBody(TEST_REPOSITORY.fullName), action: 'stale' };
      const res = await send('workflow_run', body);

      expect(res.status()).toBe(200);
      expect(await res.json()).toMatchObject({ ok: true, ignored: true });
    });

    test('an untracked repository is ignored', async () => {
      const res = await send('workflow_run', workflowRunBody('linuxfoundation/not-tracked-anywhere'));

      expect(res.status()).toBe(200);
      expect(await res.json()).toMatchObject({ ok: true, ignored: true });
    });
  });

  test.describe('Recording a workflow run', () => {
    test('a completed run on a released tag succeeds the job', async () => {
      const runId = nextRunId++;
      const res = await send('workflow_run', workflowRunBody(TEST_REPOSITORY.fullName, { runId, headBranch: 'v1.0.0' }));
      expect(res.status()).toBe(200);

      const job = await jobFor('v1.0.0');
      expect(job, 'a release job should exist for the released tag').not.toBeNull();
      expect(job!.status).toBe('succeeded');
      expect(job!.workflowRunId).toBe(String(runId));
      expect(job!.workflowName).toBe('Docker Build - Release');
      expect(job!.conclusion).toBe('success');
      expect(job!.completedAt).not.toBeNull();
    });

    test('a run still in progress leaves the job running and uncompleted', async () => {
      const res = await send('workflow_run', workflowRunBody(TEST_REPOSITORY.fullName, { headBranch: 'v1.1.0', status: 'in_progress', conclusion: null }));
      expect(res.status()).toBe(200);

      const job = await jobFor('v1.1.0');
      expect(job!.status).toBe('running');
      expect(job!.conclusion).toBeNull();
      expect(job!.completedAt).toBeNull();
    });

    test("a cancelled run fails the job while keeping GitHub's own word for it", async () => {
      const res = await send('workflow_run', workflowRunBody(TEST_REPOSITORY.fullName, { headBranch: 'v1.2.0-rc.1', conclusion: 'cancelled' }));
      expect(res.status()).toBe(200);

      const job = await jobFor('v1.2.0-rc.1');
      expect(job!.status).toBe('failed');
      expect(job!.conclusion).toBe('cancelled');
    });

    test('a run on a branch rather than a released tag records nothing', async () => {
      const res = await send('workflow_run', workflowRunBody(TEST_REPOSITORY.fullName, { headBranch: 'main' }));
      expect(res.status()).toBe(200);

      expect(await jobFor('main')).toBeNull();
    });

    test("a run on a draft release's tag records nothing", async () => {
      const res = await send('workflow_run', workflowRunBody(TEST_REPOSITORY.fullName, { headBranch: 'v1.3.0-draft' }));
      expect(res.status()).toBe(200);

      expect(await jobFor('v1.3.0-draft')).toBeNull();
    });

    test('a service retired while CI is running still gets its finished run', async () => {
      const prisma = getTestPrismaClient();
      const service = await prisma.releasableService.findFirstOrThrow({
        where: { repository: { fullName: TEST_REPOSITORY.fullName } },
      });

      await send('release', releaseBody(TEST_REPOSITORY.fullName, 'v5.0.0'));
      await prisma.releasableService.update({ where: { id: service.id }, data: { isActive: false } });

      try {
        const runId = nextRunId++;
        const res = await send('workflow_run', workflowRunBody(TEST_REPOSITORY.fullName, { runId, headBranch: 'v5.0.0' }));
        expect(res.status()).toBe(200);

        // Dropping this would leave the job at `pending` with nothing left to correct it.
        const job = await prisma.releaseJob.findFirst({ where: { tagName: 'v5.0.0', releasableServiceId: service.id } });
        expect(job!.status).toBe('succeeded');
      } finally {
        await prisma.releasableService.update({ where: { id: service.id }, data: { isActive: true } });
      }
    });

    test('a retired service records nothing even for a published tag', async () => {
      const res = await send('workflow_run', workflowRunBody(TEST_RETIRED_REPOSITORY.fullName, { headBranch: 'ret-v0.1.0' }));
      expect(res.status()).toBe(200);

      const job = await getTestPrismaClient().releaseJob.findFirst({ where: { tagName: 'ret-v0.1.0' } });
      expect(job).toBeNull();
    });
  });

  test.describe('Ordering deliveries for one run', () => {
    test('a redelivery of an earlier state does not undo a finished run', async () => {
      const runId = nextRunId++;
      await send('release', releaseBody(TEST_REPOSITORY.fullName, 'v4.0.0'));
      await send('workflow_run', workflowRunBody(TEST_REPOSITORY.fullName, { runId, headBranch: 'v4.0.0', updatedAt: '2026-09-18T10:06:00Z' }));

      // GitHub redelivers, and does not promise order. The same run reporting an earlier state
      // must not walk a finished job back to running.
      const res = await send(
        'workflow_run',
        workflowRunBody(TEST_REPOSITORY.fullName, {
          runId,
          headBranch: 'v4.0.0',
          status: 'in_progress',
          conclusion: null,
          updatedAt: '2026-09-18T10:02:00Z',
        })
      );
      expect(res.status()).toBe(200);

      const job = await jobFor('v4.0.0');
      expect(job!.status).toBe('succeeded');
      expect(job!.conclusion).toBe('success');
    });

    test('a re-run of a failed run moves the job back to running', async () => {
      const runId = nextRunId++;
      await send('release', releaseBody(TEST_REPOSITORY.fullName, 'v4.1.0'));
      await send(
        'workflow_run',
        workflowRunBody(TEST_REPOSITORY.fullName, { runId, headBranch: 'v4.1.0', conclusion: 'failure', updatedAt: '2026-09-18T10:06:00Z' })
      );
      expect((await jobFor('v4.1.0'))!.status).toBe('failed');

      // GitHub reuses the run id for a re-run, so this arrives as the same run in an earlier
      // state — but with a later `updated_at`, which is what separates it from a redelivery.
      const res = await send(
        'workflow_run',
        workflowRunBody(TEST_REPOSITORY.fullName, {
          runId,
          headBranch: 'v4.1.0',
          status: 'in_progress',
          conclusion: null,
          updatedAt: '2026-09-18T11:00:00Z',
        })
      );
      expect(res.status()).toBe(200);

      const job = await jobFor('v4.1.0');
      expect(job!.status).toBe('running');
      expect(job!.completedAt).toBeNull();
    });
  });

  test.describe('Opening a job from a release', () => {
    test('a published release opens a pending job with no attribution', async () => {
      const res = await send('release', releaseBody(TEST_REPOSITORY.fullName, 'v2.0.0'));
      expect(res.status()).toBe(200);

      const job = await jobFor('v2.0.0');
      expect(job, 'publishing a release should open a job for the tag').not.toBeNull();
      expect(job!.status).toBe('pending');
      expect(job!.workflowRunId).toBeNull();
      // The webhook cannot know who published; only the publish endpoint can.
      expect(job!.requestedById).toBeNull();
    });

    test('a draft release opens nothing', async () => {
      const res = await send('release', releaseBody(TEST_REPOSITORY.fullName, 'v2.1.0-draft', { draft: true }));
      expect(res.status()).toBe(200);

      expect(await jobFor('v2.1.0-draft')).toBeNull();
    });

    test('an edited release opens nothing — only publishing does', async () => {
      const res = await send('release', releaseBody(TEST_REPOSITORY.fullName, 'v2.2.0', { action: 'edited' }));
      expect(res.status()).toBe(200);

      expect(await jobFor('v2.2.0')).toBeNull();
    });

    test('a run for a tag whose job is already open is recorded on it', async () => {
      await send('release', releaseBody(TEST_REPOSITORY.fullName, 'v2.3.0'));
      const runId = nextRunId++;
      const res = await send('workflow_run', workflowRunBody(TEST_REPOSITORY.fullName, { runId, headBranch: 'v2.3.0' }));
      expect(res.status()).toBe(200);

      const job = await jobFor('v2.3.0');
      expect(job!.status).toBe('succeeded');
      expect(job!.workflowRunId).toBe(String(runId));
      // Taken from the payload, not the clock, so a redelivery does not move it.
      expect(job!.completedAt?.toISOString()).toBe('2026-09-18T10:06:00.000Z');
    });
  });

  test.describe('Recording a workflow job', () => {
    test('job progress lands on the release job for its run, newest state per name', async () => {
      const runId = nextRunId++;
      await send(
        'workflow_run',
        workflowRunBody(TEST_FOREIGN_REPOSITORY.fullName, { runId, headBranch: 'sec-v0.9.0', status: 'in_progress', conclusion: null })
      );

      const jobBody = (status: string, conclusion: string | null) => ({
        action: status === 'completed' ? 'completed' : 'in_progress',
        repository: { full_name: TEST_FOREIGN_REPOSITORY.fullName, default_branch: 'main' },
        workflow_job: { run_id: runId, name: 'build-and-push', status, conclusion, started_at: '2026-09-18T10:00:05Z', completed_at: null },
      });

      expect((await send('workflow_job', jobBody('in_progress', null))).status()).toBe(200);
      expect((await send('workflow_job', jobBody('completed', 'success'))).status()).toBe(200);

      const job = await getTestPrismaClient().releaseJob.findFirst({ where: { workflowRunId: String(runId) } });
      const steps = z.array(ReleaseJobStepSchema).parse(job!.steps);

      // Two deliveries for one job name collapse to one entry carrying the later state.
      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({ name: 'build-and-push', status: 'completed', conclusion: 'success' });
    });

    test('a job for an unknown run is ignored', async () => {
      const body = {
        action: 'completed',
        repository: { full_name: TEST_REPOSITORY.fullName, default_branch: 'main' },
        workflow_job: { run_id: 9_999_999_999, name: 'orphan', status: 'completed', conclusion: 'success', started_at: null, completed_at: null },
      };

      const res = await send('workflow_job', body);
      expect(res.status()).toBe(200);
      expect(await res.json()).toMatchObject({ ok: true });

      // A regression that matched the orphan against some other row would still return 200.
      const touched = await getTestPrismaClient().releaseJob.findMany({ select: { steps: true } });
      expect(touched.some((job) => JSON.stringify(job.steps).includes('orphan'))).toBe(false);
    });
  });

  /**
   * The fan-out this suite would otherwise never reach: `ProductRepository` is unique on
   * (product, owner, name), so one GitHub repository can be tracked by two products, each with
   * its own releasable service. A single workflow run then has to report to both jobs — which is
   * why the run id is indexed rather than unique. Built and torn down here so the rest of the
   * suite, and every other spec, still sees the seeded repository tracked once.
   */
  test.describe('A repository tracked by two products', () => {
    const TAG = 'v3.0.0';
    let sharedRepositoryId: string;

    test.beforeAll(async () => {
      const prisma = getTestPrismaClient();
      const secondProduct = await prisma.product.findUniqueOrThrow({ where: { slug: 'e2e-security' } });

      const shared = await prisma.productRepository.create({
        data: {
          productId: secondProduct.id,
          githubInstallationId: TEST_REPOSITORY.githubInstallationId,
          owner: TEST_REPOSITORY.owner,
          name: TEST_REPOSITORY.name,
          fullName: TEST_REPOSITORY.fullName,
          htmlUrl: TEST_REPOSITORY.htmlUrl,
        },
      });
      sharedRepositoryId = shared.id;

      await prisma.releasableService.create({
        data: { repositoryId: shared.id, displayName: 'E2E Shared API', aliases: ['shared'], deploymentType: 'standalone', appName: 'e2e-shared' },
      });
    });

    test.afterAll(async () => {
      const prisma = getTestPrismaClient();
      await prisma.gitHubRelease.deleteMany({ where: { repositoryId: sharedRepositoryId } });
      await prisma.productRepository.delete({ where: { id: sharedRepositoryId } });
    });

    test('one run and one job report to the release job of every product tracking the repository', async () => {
      const openRes = await send('release', releaseBody(TEST_REPOSITORY.fullName, TAG));
      expect(openRes.status()).toBe(200);

      const prisma = getTestPrismaClient();
      expect(await prisma.releaseJob.count({ where: { tagName: TAG } }), 'publishing should open a job per product').toBe(2);

      const runId = nextRunId++;
      expect((await send('workflow_run', workflowRunBody(TEST_REPOSITORY.fullName, { runId, headBranch: TAG }))).status()).toBe(200);

      const jobs = await prisma.releaseJob.findMany({ where: { tagName: TAG } });
      expect(jobs).toHaveLength(2);
      // Both, not whichever one a `findFirst` happened to return.
      expect(jobs.every((job) => job.workflowRunId === String(runId))).toBe(true);
      expect(jobs.every((job) => job.status === 'succeeded')).toBe(true);

      const jobEvent = {
        action: 'completed',
        repository: { full_name: TEST_REPOSITORY.fullName, default_branch: 'main' },
        workflow_job: { run_id: runId, name: 'build-and-push', status: 'completed', conclusion: 'success', started_at: null, completed_at: null },
      };
      expect((await send('workflow_job', jobEvent)).status()).toBe(200);

      const withSteps = await prisma.releaseJob.findMany({ where: { tagName: TAG }, select: { steps: true } });
      expect(
        withSteps.every((job) =>
          z
            .array(ReleaseJobStepSchema)
            .parse(job.steps)
            .some((step) => step.name === 'build-and-push')
        )
      ).toBe(true);
    });
  });

  test.describe('Changelog agent isolation', () => {
    test('a workflow event does not trigger the changelog agent', async () => {
      const prisma = getTestPrismaClient();
      const before = await prisma.agentJob.count({ where: { trigger: 'webhook_push' } });

      await send('workflow_run', workflowRunBody(TEST_REPOSITORY.fullName, { headBranch: 'v1.0.0' }));

      // The agent is fired after the response is sent, so the absence of a job is only
      // meaningful once one would have had time to appear. The trigger map falls back to
      // `webhook_push` for unrecognised events, which is what the controller's early return
      // for workflow events exists to prevent.
      await settle();

      expect(await prisma.agentJob.count({ where: { trigger: 'webhook_push' } })).toBe(before);
    });

    test('a workflow event with no payload is still kept away from the agent', async () => {
      const prisma = getTestPrismaClient();
      const before = await prisma.agentJob.count({ where: { trigger: 'webhook_push' } });

      // The guard keys on the event, not on the payload object. Keyed on the object, a delivery
      // GitHub shaped differently would fall through to the trigger map and run the agent.
      const res = await send('workflow_run', { action: 'completed', repository: { full_name: TEST_REPOSITORY.fullName, default_branch: 'main' } });
      expect(res.status()).toBe(200);

      await settle();

      expect(await prisma.agentJob.count({ where: { trigger: 'webhook_push' } })).toBe(before);
    });
  });
});
