// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { ReleaseJobStatus, ReleaseJobStepSchema } from '@lfx-changelog/shared';
import { z } from 'zod';

import { serverLogger } from '../server-logger';
import { getPrismaClient } from './prisma.service';

import type { ReleaseJobStep } from '@lfx-changelog/shared';
import type { WorkflowJobPayload, WorkflowRunPayload } from '../interfaces/release.interface';

/** GitHub's job states in the order they occur. Anything unrecognised sorts first, so it loses. */
const JOB_STATE_ORDER = ['queued', 'waiting', 'in_progress', 'completed'];

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
      // Never empty: an empty `update` is compiled to a select and a plain insert instead of
      // `ON CONFLICT`, which reopens the race this is here to settle. Rewriting the tag with
      // its own value is the no-op that keeps it a single atomic statement.
      update: requestedById ? { requestedById } : { tagName },
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

    // `head_branch` carries the tag only for a tag push; for anything else it is a branch name.
    // A pull request from a branch called `v1.0.0` is not that release's CI, and on a public
    // repository anyone can open one.
    if (run.event !== 'push' && run.event !== 'release') {
      serverLogger.debug({ repositoryId, tagName, runId: run.id, event: run.event }, 'Workflow run is not from a tag push — ignoring');
      return;
    }

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
    // `updated_at` orders the states of one run; it says nothing across runs, because a run still
    // executing when another supersedes it goes on reporting later timestamps. Start time is what
    // separates an older run from a newer one, and it has to be strictly later to take the job
    // over: two workflows triggered by one tag push start in the same second, and letting either
    // displace the other would leave them trading the row back and forth.
    const runStartedAt = run.run_started_at ? new Date(run.run_started_at) : runUpdatedAt;

    const runFields = {
      status,
      workflowRunId,
      runUpdatedAt,
      workflowRunUrl: run.html_url ?? null,
      workflowName: run.name ?? null,
      conclusion: run.conclusion ?? null,
      startedAt: runStartedAt,
      // Taken from the payload so that a redelivery of the same event writes the same row,
      // rather than moving the finish time to whenever the redelivery happened to arrive.
      completedAt: isFinished && run.updated_at ? new Date(run.updated_at) : null,
    };

    // Make sure the row exists, without touching one that does. This serves a release the
    // application did not publish and has not yet seen a `published` event for — a manual sync,
    // or an edit to a release created on github.com. It deliberately does not apply the run:
    // two first deliveries can both find no row, and whichever loses this upsert would
    // otherwise discard its state entirely rather than fall through to the writes below.
    await prisma.releaseJob.upsert({
      where: { releasableServiceId_tagName: { releasableServiceId, tagName } },
      create: { releasableServiceId, tagName },
      // See openForRelease: an empty `update` is not compiled to `ON CONFLICT`.
      update: { tagName },
    });

    // Both writes below name the run they expect to find, and refuse a delivery that is behind
    // what is recorded. Doing that in the predicate rather than from a prior read is what makes
    // them safe: GitHub delivers `in_progress` and `completed` closely enough to be in flight at
    // once, and a decision taken from a snapshot is already stale by the time it is written.
    // `updated_at` has second precision, so two transitions of a quick job share a timestamp.
    // A delivery that reports a finished run may land on an equal one, being idempotent; one
    // that reports an unfinished run may not, or a late `in_progress` would undo the completion
    // it was issued a fraction of a second before. A later timestamp is a re-run and is allowed.
    const notOlder = isFinished
      ? { OR: [{ runUpdatedAt: null }, { runUpdatedAt: { lte: runUpdatedAt } }] }
      : {
          OR: [{ runUpdatedAt: null }, { runUpdatedAt: { lt: runUpdatedAt } }, { status: { notIn: [ReleaseJobStatus.SUCCEEDED, ReleaseJobStatus.FAILED] } }],
        };

    // The run already on this job: advance it, keeping the steps its own jobs have recorded.
    const advanced = await prisma.releaseJob.updateMany({
      where: { releasableServiceId, tagName, workflowRunId, ...notOlder },
      data: runFields,
    });

    // Otherwise this run takes the job over, and the previous run's steps are not its own. The
    // run being replaced is named in the predicate, so a second delivery for this same run
    // cannot wipe the steps the first one's jobs have since recorded.
    const taken =
      advanced.count > 0
        ? 0
        : (
            await prisma.releaseJob.updateMany({
              where: {
                releasableServiceId,
                tagName,
                AND: [
                  { OR: [{ workflowRunId: null }, { workflowRunId: { not: workflowRunId } }] },
                  { OR: [{ startedAt: null }, { startedAt: { lt: runStartedAt } }] },
                ],
              },
              data: { ...runFields, steps: [] },
            })
          ).count;

    if (advanced.count === 0 && taken === 0) {
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
    if (typeof job.run_id !== 'number' || typeof job.id !== 'number') return;

    const prisma = getPrismaClient();
    const workflowRunId = String(job.run_id);
    const next: ReleaseJobStep = {
      jobId: job.id,
      attempt: job.run_attempt ?? 1,
      name: job.name,
      status: job.status,
      conclusion: job.conclusion ?? null,
      startedAt: job.started_at ?? null,
      completedAt: job.completed_at ?? null,
    };

    // Merging a JSON array is a read, a change and a write, so it runs inside a transaction that
    // locks the rows first. GitHub emits the jobs of one run together — a matrix fans out, and a
    // `needs:` edge finishes one job as it queues the next — so without the lock each delivery
    // writes back a list it read before the other, and one of them is simply gone.
    const matched = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string; steps: unknown }[]>`
        SELECT "id", "steps" FROM "release_jobs" WHERE "workflow_run_id" = ${workflowRunId} FOR UPDATE
      `;

      for (const row of rows) {
        const steps = this.parseSteps(row.id, row.steps);
        const stored = steps.find((step) => step.name === next.name);

        // Attempts are ordered, so a delayed delivery from the attempt before cannot replace the
        // one now running; within an attempt the job's own states are, so a `queued` arriving
        // after an `in_progress` cannot either. Delivery order is not promised for either.
        if (stored) {
          if (stored.attempt > next.attempt) continue;
          if (stored.attempt === next.attempt && this.stateRank(next.status) < this.stateRank(stored.status)) continue;
        }

        await tx.releaseJob.update({
          where: { id: row.id },
          data: { steps: [...steps.filter((step) => step.name !== next.name), next] },
        });
      }

      return rows.length;
    });

    if (matched === 0) {
      serverLogger.debug({ runId: job.run_id, jobName: job.name }, 'Workflow job belongs to no release job — ignoring');
      return;
    }

    serverLogger.debug({ runId: job.run_id, jobName: job.name, status: job.status, jobs: matched }, 'Recorded workflow job on release job');
  }

  // ── Private helpers ─────────────────────────

  /**
   * The releasable service whose tag this is, or null when the tag is not one we released.
   *
   * A service with an open job for the tag matches whether or not it is still active, so that
   * retiring one mid-deploy does not strand the job already following that release. Otherwise
   * the service must be active and the tag must have a published, non-draft release.
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

  /** Where a job state sits in the sequence GitHub reports, for refusing one that goes backwards. */
  private stateRank(status: string): number {
    return Math.max(JOB_STATE_ORDER.indexOf(status), 0);
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
