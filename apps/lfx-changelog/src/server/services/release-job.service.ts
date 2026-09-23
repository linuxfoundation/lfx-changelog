// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { ReleaseJobStatus, ReleaseJobStepSchema } from '@lfx-changelog/shared';
import { z } from 'zod';

import { serverLogger } from '../server-logger';
import { getPrismaClient } from './prisma.service';

import type { ReleaseJobStep } from '@lfx-changelog/shared';
import type { WorkflowJobPayload, WorkflowRunPayload } from '../interfaces/release.interface';

export class ReleaseJobService {
  /**
   * Opens a job for a released tag. Repositories with no active releasable service are ignored —
   * most tracked repositories are not deployable, so there is nothing to follow, and a service
   * that has been retired should stop accruing jobs.
   *
   * Called twice for a release published here: once by the publish endpoint, which knows who
   * asked, and once by the webhook, which does not. Either may arrive first — GitHub dispatches
   * the webhook independently of our own round-trip — so the publish path fills the attribution
   * in whether it created the row or found one. The webhook passes none and so cannot clear it.
   */
  public async openForRelease(repositoryId: string, tagName: string, requestedById?: string): Promise<void> {
    const prisma = getPrismaClient();
    const service = await prisma.releasableService.findFirst({ where: { repositoryId, isActive: true }, select: { id: true } });
    if (!service) return;

    await prisma.releaseJob.upsert({
      where: { releasableServiceId_tagName: { releasableServiceId: service.id, tagName } },
      create: { releasableServiceId: service.id, tagName, requestedById: requestedById ?? null },
      update: requestedById ? { requestedById } : {},
    });

    serverLogger.info({ repositoryId, tagName, requestedById: requestedById ?? null }, 'Opened release job for released tag');
  }

  /**
   * Attaches a workflow run to the job for its tag and moves the job to the run's state.
   *
   * The run is matched by `head_branch`, which carries the tag name for a tag-triggered push.
   * A tag with no job and no published release is not one of ours, so ordinary branch and pull
   * request builds pass straight through without inventing a job for them.
   */
  public async recordWorkflowRun(repositoryId: string, run: WorkflowRunPayload): Promise<void> {
    const tagName = run.head_branch;
    // Without a usable id the row would store the string "undefined", which the job lookup then
    // treats as a real run and matches against every other row that stored it.
    if (!tagName || typeof run.id !== 'number') return;

    const prisma = getPrismaClient();
    const releasableServiceId = await this.resolveReleasedTag(repositoryId, tagName);
    if (!releasableServiceId) {
      serverLogger.debug({ repositoryId, tagName, runId: run.id }, 'Workflow run is not for a released tag — ignoring');
      return;
    }

    const workflowRunId = String(run.id);
    const status = this.statusFor(run);
    const isFinished = status === ReleaseJobStatus.SUCCEEDED || status === ReleaseJobStatus.FAILED;
    // GitHub advances this on every state change, so it orders the deliveries for one run.
    const runUpdatedAt = run.updated_at ? new Date(run.updated_at) : new Date();

    const existing = await prisma.releaseJob.findUnique({
      where: { releasableServiceId_tagName: { releasableServiceId, tagName } },
      select: { workflowRunId: true },
    });

    // A different run supersedes this tag's previous one, and the steps recorded against that
    // run are not this one's, so they start again rather than merging by job name across runs.
    // A re-run is not a different run — GitHub reuses the id — so its steps overwrite by name.
    const supersedes = Boolean(existing?.workflowRunId) && existing?.workflowRunId !== workflowRunId;

    const runFields = {
      status,
      workflowRunId,
      runUpdatedAt,
      ...(supersedes ? { steps: [] } : {}),
      workflowRunUrl: run.html_url ?? null,
      workflowName: run.name ?? null,
      conclusion: run.conclusion ?? null,
      startedAt: run.run_started_at ? new Date(run.run_started_at) : null,
      // Taken from the payload so that a redelivery of the same event writes the same row,
      // rather than moving the finish time to whenever the redelivery happened to arrive.
      completedAt: isFinished && run.updated_at ? new Date(run.updated_at) : null,
    };

    // The create branch serves a release this application did not publish and has not yet seen a
    // `published` event for — a manual sync, or an edit to a release created on github.com.
    if (!existing) {
      await prisma.releaseJob.upsert({
        where: { releasableServiceId_tagName: { releasableServiceId, tagName } },
        create: { releasableServiceId, tagName, ...runFields },
        update: {},
      });
      serverLogger.info({ repositoryId, tagName, runId: run.id, status }, 'Opened release job from a workflow run');
      return;
    }

    // Ordering is a condition on the write rather than a check before it. GitHub delivers
    // `in_progress` and `completed` closely enough to be in flight together, so a read followed
    // by an unconditional write would let the earlier delivery land last and report a finished
    // run as still running.
    const { count } = await prisma.releaseJob.updateMany({
      where: {
        releasableServiceId,
        tagName,
        OR: [{ runUpdatedAt: null }, { runUpdatedAt: { lte: runUpdatedAt } }],
      },
      data: runFields,
    });

    if (count === 0) {
      serverLogger.debug({ repositoryId, tagName, runId: run.id, status }, 'Workflow run delivery is older than the recorded state — ignoring');
      return;
    }

    serverLogger.info({ repositoryId, tagName, runId: run.id, status, conclusion: run.conclusion }, 'Recorded workflow run on release job');
  }

  /**
   * Records one job's progress within a run, keyed by name so repeated deliveries overwrite.
   *
   * A repository tracked by several products has a release job per product, and the single run
   * reports to each of them.
   */
  public async recordWorkflowJob(job: WorkflowJobPayload): Promise<void> {
    if (typeof job.run_id !== 'number') return;

    const prisma = getPrismaClient();
    const releaseJobs = await prisma.releaseJob.findMany({
      where: { workflowRunId: String(job.run_id) },
      select: { id: true, steps: true },
    });

    if (releaseJobs.length === 0) {
      serverLogger.debug({ runId: job.run_id, jobName: job.name }, 'Workflow job belongs to no release job — ignoring');
      return;
    }

    const next: ReleaseJobStep = {
      name: job.name,
      status: job.status,
      conclusion: job.conclusion ?? null,
      startedAt: job.started_at ?? null,
      completedAt: job.completed_at ?? null,
    };

    for (const releaseJob of releaseJobs) {
      await prisma.releaseJob.update({
        where: { id: releaseJob.id },
        data: { steps: [...this.parseSteps(releaseJob.id, releaseJob.steps).filter((step) => step.name !== next.name), next] },
      });
    }

    serverLogger.debug({ runId: job.run_id, jobName: job.name, status: job.status, jobs: releaseJobs.length }, 'Recorded workflow job on release job');
  }

  // ── Private helpers ─────────────────────────

  /**
   * The active releasable service whose tag this is, or null when the repository has no active
   * service or the tag is not one we released.
   *
   * An open job counts as evidence on its own: the publish endpoint opens one before GitHub has
   * delivered anything, so a run can reach us while the release row is still in flight.
   */
  private async resolveReleasedTag(repositoryId: string, tagName: string): Promise<string | null> {
    const prisma = getPrismaClient();
    const service = await prisma.releasableService.findFirst({
      where: {
        repositoryId,
        OR: [
          // An open job is followed to the end even if the service is retired while CI is still
          // running — otherwise the delivery that would have finished it is dropped and the job
          // sits at `running` with nothing left to correct it.
          { jobs: { some: { tagName } } },
          // A job is only opened for a service still in service.
          { isActive: true, repository: { releases: { some: { tagName, isDraft: false } } } },
        ],
      },
      select: { id: true },
    });

    return service?.id ?? null;
  }

  /** Reads the stored steps, treating a shape this version cannot read as no steps at all. */
  private parseSteps(releaseJobId: string, steps: unknown): ReleaseJobStep[] {
    const parsed = z.array(ReleaseJobStepSchema).safeParse(steps);
    if (parsed.success) return parsed.data;

    // Loud, because the merge below then rebuilds the list from this one event and whatever was
    // already recorded is gone.
    serverLogger.warn({ releaseJobId, issues: parsed.error.issues }, 'Stored release job steps could not be read — restarting the list');
    return [];
  }

  /**
   * GitHub's conclusions are richer than the four states a job has, so the raw conclusion is kept
   * alongside: anything that completed without succeeding is a failure here, cancellations included.
   */
  private statusFor(run: WorkflowRunPayload): ReleaseJobStatus {
    if (run.status !== 'completed') return ReleaseJobStatus.RUNNING;
    return run.conclusion === 'success' ? ReleaseJobStatus.SUCCEEDED : ReleaseJobStatus.FAILED;
  }
}
