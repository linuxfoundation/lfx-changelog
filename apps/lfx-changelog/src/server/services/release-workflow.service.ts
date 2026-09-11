// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { randomUUID } from 'node:crypto';

import { Prisma } from '@prisma/client';

import { serverLogger } from '../server-logger';
import { getPrismaClient } from './prisma.service';
import { releasableCatalogService } from './releasable-catalog.service';
import { ARGOCD_REPO, releaseArgocdService } from './release-argocd.service';
import { releaseAuthService } from './release-auth.service';
import { computeNextTag, releaseGitHubAuditService } from './release-github-audit.service';
import { releaseGitHubService } from './release-github.service';
import { releaseJobEmitter } from './release-job-emitter.service';
import { releaseSlackMapService } from './release-slack-map.service';
import { escapeSlackMrkdwn, releaseSlackService, slackAuthorMention } from './release-slack.service';
import { isArgocdSyncEnabled, releaseSyncService } from './release-sync.service';

import { ReleaseJobStatus } from '@lfx-changelog/shared';

import type { ReleaseProgressLine, ReleaseProgressType } from '@lfx-changelog/shared';
import type { ReleaseJob } from '@prisma/client';

// Value: whether a rerun was requested while this job's claimAndRun() was already in flight.
const running = new Map<string, boolean>();
const INSTANCE_ID = randomUUID();
const LEASE_TTL_MS = 10 * 60 * 1000;
const LEASE_RENEW_MS = 3 * 60 * 1000;
const RESUME_POLL_MS = 5 * 60 * 1000;

export class ReleaseWorkflowService {
  private resumePollerStarted = false;

  /**
   * Periodically re-invokes `resumeRunningJobs()` so a job whose owning replica crashed
   * gets picked up once its lease expires, rather than only at the next deploy/restart
   * (when a crash happens to land before the lease had expired, the one-shot startup
   * call misses it and nothing else would ever retry).
   */
  public startResumePoller(): void {
    if (this.resumePollerStarted) {
      return;
    }
    this.resumePollerStarted = true;
    setInterval(() => {
      this.resumeRunningJobs().catch((err) => serverLogger.error({ err }, 'Periodic resume of in-flight release jobs failed'));
    }, RESUME_POLL_MS);
    this.resumeRunningJobs().catch((err) => serverLogger.error({ err }, 'Failed to resume in-flight release jobs'));
  }

  /**
   * Re-kicks off any job left in `running` status by a process that exited
   * mid-job (crash, redeploy). Each external step in `run()` is checkpointed
   * against the job row before it executes, so resuming re-enters at the
   * first incomplete step rather than repeating finished ones. The chart runs
   * multiple replicas, so `kickoff()` only actually proceeds if it wins the
   * DB-backed lease below — otherwise another replica already owns this job.
   */
  public async resumeRunningJobs(): Promise<void> {
    const prisma = getPrismaClient();
    const jobs = await prisma.releaseJob.findMany({ where: { status: 'running' }, select: { id: true } });
    for (const job of jobs) {
      this.kickoff(job.id);
    }
  }

  /**
   * Lease fields to merge into a `status: 'running'` write made outside this
   * service (the merge-queue poller), so that transition claims the lease in
   * the same atomic update that claims the row.
   */
  public leaseClaimFields(): { leaseOwner: string; leaseExpiresAt: Date } {
    return { leaseOwner: INSTANCE_ID, leaseExpiresAt: new Date(Date.now() + LEASE_TTL_MS) };
  }

  public async startJob(input: { serviceKey: string; notes: string; newTag: string; headSha: string | null; requesterId: string }): Promise<ReleaseJob> {
    const service = releasableCatalogService.require(input.serviceKey);
    const productId = await releaseAuthService.mappedProductId(service.key);
    const audit = await releaseGitHubAuditService.audit(service.githubRepo, { fresh: true });
    if (audit.error) {
      throw new Error(audit.error);
    }
    if (audit.pending.length === 0) {
      throw new Error('Nothing to release');
    }
    const tags = computeNextTag(audit.latestTag);
    if (input.newTag && input.newTag !== tags.newTag) {
      const stale = new Error('STALE_TAG');
      (stale as Error & { expectedTag: string }).expectedTag = tags.newTag;
      throw stale;
    }
    if (input.headSha !== audit.headSha) {
      const stale = new Error('STALE_HEAD_SHA');
      (stale as Error & { expectedHeadSha: string | null }).expectedHeadSha = audit.headSha;
      throw stale;
    }
    const newTag = tags.newTag;

    const prisma = getPrismaClient();
    try {
      const job = await prisma.releaseJob.create({
        data: {
          serviceKey: service.key,
          productId,
          requesterId: input.requesterId,
          status: 'running',
          latestTag: audit.latestTag,
          newTag,
          argocdTag: tags.argocdTag,
          releaseHeadSha: audit.headSha,
          releaseNotes: input.notes,
          startedAt: new Date(),
        },
      });
      this.kickoff(job.id);
      return job;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await releaseAuthService.findActiveJob(service.key);
        if (existing) {
          const conflict = new Error('ACTIVE_JOB');
          (conflict as Error & { jobId: string; status: string }).jobId = existing.id;
          (conflict as Error & { jobId: string; status: string }).status = existing.status;
          throw conflict;
        }
      }
      throw error;
    }
  }

  public async retry(jobId: string): Promise<ReleaseJob> {
    const prisma = getPrismaClient();
    const job = await prisma.releaseJob.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new Error('Job not found');
    }
    if (job.status !== 'failed') {
      throw new Error('Nothing left to retry');
    }
    // Refuse to reactivate a stale failure. A `failed` row no longer holds the
    // `active job per service` DB constraint, so a newer release can start and
    // complete for the same service while this row waits. Retrying without a
    // freshness check would resume the old job — potentially re-opening its
    // still-open GitOps PR and enqueueing an older image pin — which would
    // effectively downgrade the deploy. Block the retry when either a newer
    // completed release exists or another active job is already running for
    // the same service, and tell the caller to start a fresh release.
    const stalenessCutoff = job.completedAt ?? job.startedAt ?? job.createdAt;
    const [newerCompleted, activeElsewhere] = await Promise.all([
      prisma.releaseJob.findFirst({
        where: {
          serviceKey: job.serviceKey,
          id: { not: jobId },
          status: 'completed',
          completedAt: { gt: stalenessCutoff },
        },
        orderBy: { completedAt: 'desc' },
        select: { newTag: true, completedAt: true },
      }),
      releaseAuthService.findActiveJob(job.serviceKey),
    ]);
    if (newerCompleted) {
      throw new Error(
        `A newer release for ${job.serviceKey} has already completed (${newerCompleted.newTag}). Retrying this job could downgrade the deploy; start a fresh release instead.`
      );
    }
    if (activeElsewhere && activeElsewhere.id !== jobId) {
      throw new Error(`An active release job already exists for ${job.serviceKey} (${activeElsewhere.id}).`);
    }
    const ciFailed = job.ciStatus === 'Failed' || job.ciStatus === 'Timed out';
    const updated = await prisma.releaseJob.update({
      where: { id: jobId },
      data: {
        status: 'running',
        errorMessage: null,
        startedAt: job.startedAt ?? new Date(),
        ...(ciFailed ? { ciStatus: null, ciRunUrl: null } : {}),
      },
    });
    this.kickoff(jobId);
    return updated;
  }

  public async cancel(jobId: string, cancelledById: string): Promise<ReleaseJob> {
    const prisma = getPrismaClient();
    const job = await prisma.releaseJob.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new Error('Job not found');
    }
    const claim = await prisma.releaseJob.updateMany({
      where: { id: jobId, status: 'waiting_for_approval', mergeQueuedAt: null },
      data: { status: 'cancelled', cancelledById, completedAt: new Date(), leaseOwner: null, leaseExpiresAt: null },
    });
    if (claim.count !== 1) {
      const current = await prisma.releaseJob.findUniqueOrThrow({ where: { id: jobId } });
      if (current.status === 'waiting_for_approval' && current.mergeQueuedAt) {
        throw new Error('Release is already in the merge queue and can no longer be cancelled');
      }
      throw new Error('Job is not waiting for approval');
    }
    const updated = await prisma.releaseJob.findUniqueOrThrow({ where: { id: jobId } });
    await this.append(jobId, 'approval', 'info', 'Wait cancelled. GitHub release and pull request remain.');
    if (updated.slackThreadTs) {
      const slack = await releaseSlackService.postThread(updated.slackThreadTs, 'Release wait cancelled. GitHub release and ArgoCD PR remain.');
      if (!slack.ok) {
        await this.append(jobId, 'slack_summary', 'skip', `Slack cancel notice skipped: ${slack.error}`);
      }
    }
    this.emitStatus(jobId, ReleaseJobStatus.CANCELLED);
    releaseJobEmitter.emit(jobId, { type: 'done', data: '' });
    return updated;
  }

  /**
   * If a run for this job is already in flight, records that another kickoff (e.g. a retry)
   * arrived and returns, instead of dropping it: runLoop() checks this flag after the current
   * run finishes and starts another pass if it's set, so a request that lands in the window
   * between a failed run's DB write and its cleanup is not silently lost.
   */
  public kickoff(jobId: string): void {
    if (running.has(jobId)) {
      running.set(jobId, true);
      return;
    }
    running.set(jobId, false);
    // `runLoop` awaits `claimAndRun`, which itself awaits `run`; `run`'s own
    // catch handles any release-step failure. But `claimLease` and the surrounding
    // Prisma writes can still reject before `run` gets a chance to catch (transient
    // DB hiccup, connection reset). Without this handler that rejection would (a) leak
    // the jobId in the `running` map so later `kickoff` calls only flip the rerun
    // flag on a runner that no longer exists, and (b) surface as an unhandled
    // promise rejection at the process level. Clean the map and log; the periodic
    // resume scan will pick the job back up.
    this.runLoop(jobId).catch((error) => {
      running.delete(jobId);
      serverLogger.error({ err: error, jobId }, 'Release runLoop rejected outside run(); job returned to resume-scan pool');
    });
  }

  public async append(jobId: string, step: string, type: ReleaseProgressType, summary: string, environment?: string): Promise<void> {
    const line: ReleaseProgressLine = {
      timestamp: new Date().toISOString(),
      step,
      type,
      summary,
      environment: environment ?? null,
    };
    const prisma = getPrismaClient();
    const job = await prisma.releaseJob.findUnique({ where: { id: jobId }, select: { progressLog: true } });
    const log = Array.isArray(job?.progressLog) ? (job.progressLog as ReleaseProgressLine[]) : [];
    await prisma.releaseJob.update({
      where: { id: jobId },
      data: { progressLog: [...log, line] as unknown as Prisma.InputJsonValue },
    });
    releaseJobEmitter.emit(jobId, { type: 'progress', data: line });
  }

  public async notifyThread(jobId: string, threadTs: string | null | undefined, text: string): Promise<void> {
    if (!threadTs) {
      return;
    }
    const posted = await releaseSlackService.postThread(threadTs, text);
    if (!posted.ok) {
      await this.append(jobId, 'slack_summary', 'skip', `Slack notice skipped: ${posted.error}`);
    }
  }

  public async finishAfterMerge(jobId: string): Promise<void> {
    await this.withLeaseRenewal(jobId, () => this.finishAfterMergeInner(jobId));
  }

  private async runLoop(jobId: string): Promise<void> {
    do {
      running.set(jobId, false);
      await this.claimAndRun(jobId);
    } while (running.get(jobId));
    running.delete(jobId);
  }

  private async claimLease(jobId: string): Promise<boolean> {
    const prisma = getPrismaClient();
    const claim = await prisma.releaseJob.updateMany({
      where: {
        id: jobId,
        status: 'running',
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: new Date() } }],
      },
      data: this.leaseClaimFields(),
    });
    return claim.count === 1;
  }

  private async renewLease(jobId: string): Promise<void> {
    const prisma = getPrismaClient();
    const claim = await prisma.releaseJob.updateMany({
      where: { id: jobId, leaseOwner: INSTANCE_ID },
      data: { leaseExpiresAt: new Date(Date.now() + LEASE_TTL_MS) },
    });
    if (claim.count === 0) {
      serverLogger.warn({ jobId }, 'Lease renewal found no row owned by this instance; lease may have been reclaimed by another replica');
    }
  }

  /**
   * Applies a status/lease-clearing write only if this instance still owns
   * the lease, so a replica whose lease already expired and was reclaimed by
   * another replica cannot clobber that replica's in-flight job.
   */
  private async updateIfLeaseOwner(jobId: string, data: Prisma.ReleaseJobUpdateManyMutationInput): Promise<ReleaseJob | null> {
    const prisma = getPrismaClient();
    const claim = await prisma.releaseJob.updateMany({ where: { id: jobId, leaseOwner: INSTANCE_ID }, data });
    if (claim.count !== 1) {
      serverLogger.warn({ jobId }, 'Skipped release-job status update: lease no longer owned by this instance');
      return null;
    }
    return prisma.releaseJob.findUniqueOrThrow({ where: { id: jobId } });
  }

  private async withLeaseRenewal<T>(jobId: string, fn: () => Promise<T>): Promise<T> {
    const timer = setInterval(() => {
      this.renewLease(jobId).catch((err) => serverLogger.error({ err, jobId }, 'Lease renewal failed'));
    }, LEASE_RENEW_MS);
    try {
      return await fn();
    } finally {
      clearInterval(timer);
    }
  }

  private async claimAndRun(jobId: string): Promise<void> {
    const claimed = await this.claimLease(jobId);
    if (!claimed) {
      return;
    }
    await this.withLeaseRenewal(jobId, () => this.run(jobId));
  }

  private async finishAfterMergeInner(jobId: string): Promise<void> {
    const prisma = getPrismaClient();
    let job = await prisma.releaseJob.findUniqueOrThrow({ where: { id: jobId } });
    const service = releasableCatalogService.require(job.serviceKey);

    job = await prisma.releaseJob.update({ where: { id: jobId }, data: { status: 'running' } });
    this.emitStatus(jobId, ReleaseJobStatus.RUNNING);
    const mergeLine = 'GitOps pull request merged';
    await this.append(jobId, 'merge', 'success', mergeLine);
    const syncEnabled = isArgocdSyncEnabled();
    if (job.slackThreadTs) {
      const slackMerge = syncEnabled ? 'Requesting deploy sync.' : `${mergeLine}. Changelog is not requesting an Argo CD sync.`;
      await releaseSlackService.postThread(job.slackThreadTs, slackMerge);
    }

    const syncIntro = syncEnabled ? 'Requesting Argo CD sync per environment' : 'Skipping Argo CD sync. Deploy apply is left to the cluster webhook.';
    await this.append(jobId, 'sync', syncEnabled ? 'info' : 'skip', syncIntro);
    await releaseSyncService.requestSyncs(jobId, service);
    const syncs = await prisma.environmentSync.findMany({ where: { jobId } });
    for (const sync of syncs) {
      let type: ReleaseProgressType = 'error';
      if (sync.requestStatus === 'accepted') {
        type = 'success';
      } else if (sync.requestStatus === 'skipped') {
        type = 'skip';
      }
      await this.append(
        jobId,
        'sync',
        type,
        `${sync.environment}: ${sync.requestStatus}${sync.requestError ? ` (${sync.requestError})` : ''}`,
        sync.environment
      );
    }

    const syncLine = syncs.map((row) => `${row.environment}=${row.requestStatus}`).join(', ');
    if (job.slackThreadTs) {
      const audit = await releaseGitHubAuditService.auditSince(service.githubRepo, job.latestTag, job.releaseHeadSha ?? undefined);
      const argocdLine = job.argocdPrUrl ? `<${job.argocdPrUrl}|GitOps PR>` : 'missing';
      // PR titles and author usernames are contributor-controlled. Escape mrkdwn control
      // characters on the title so a title like `<!channel>` cannot inject a mention when
      // this posts, and resolve authors to `<@SlackID>` here (scoped to only the author
      // field) instead of a global regex over the assembled message. Without this scoping
      // a PR title containing `@some-mapped-user` would be silently converted into a real
      // Slack mention downstream.
      const slackMap = await releaseSlackMapService.load();
      const pendingLines =
        audit.pending
          .map((pr) => `- #${pr.number} ${escapeSlackMrkdwn(pr.title)} ${slackAuthorMention(pr.author, slackMap)}`)
          .join('\n') || 'See GitHub release notes.';
      const summary = releaseSlackService.buildSummary({
        displayName: service.displayName,
        newTag: job.newTag,
        prCount: audit.pending.length,
        pendingLines,
        releaseUrl: job.releaseUrl || '',
        ciStatus: job.ciStatus || 'unknown',
        ciRunUrl: job.ciRunUrl || `https://github.com/${service.githubRepo}/actions`,
        ciLabel: service.ciSlackLabel,
        argocdLine,
        syncLine,
      });
      const posted = await releaseSlackService.postBroadcastSummary(job.slackThreadTs, summary);
      if (posted.ok) {
        await this.append(jobId, 'slack_summary', 'success', 'Posted Slack summary');
      } else {
        await this.append(jobId, 'slack_summary', 'skip', `Slack summary skipped: ${posted.error}`);
      }
    } else {
      await this.append(jobId, 'slack_summary', 'skip', 'Slack summary skipped: no start thread');
    }

    const completed = await this.updateIfLeaseOwner(jobId, { status: 'completed', completedAt: new Date(), leaseOwner: null, leaseExpiresAt: null });
    if (!completed) {
      return;
    }
    await this.append(jobId, 'plan', 'success', 'Release job finished. Cluster apply was not waited on.');
    this.emitStatus(jobId, ReleaseJobStatus.COMPLETED);
    releaseJobEmitter.emit(jobId, { type: 'done', data: '' });
  }

  private async run(jobId: string): Promise<void> {
    const prisma = getPrismaClient();
    try {
      let job = await prisma.releaseJob.findUniqueOrThrow({ where: { id: jobId } });
      const service = releasableCatalogService.require(job.serviceKey);

      if (!job.releaseUrl) {
        const existing = await releaseGitHubService.getReleaseByTag(service.githubRepo, job.newTag);
        let releaseUrl: string;
        if (existing) {
          if (existing.body !== job.releaseNotes) {
            throw new Error(
              `GitHub release ${job.newTag} already exists in ${service.githubRepo} with different notes; refusing to adopt it as this job's release`
            );
          }
          releaseUrl = existing.htmlUrl;
          await this.append(jobId, 'github_release', 'success', `Found existing release ${job.newTag} from a previous attempt`);
        } else {
          await this.append(jobId, 'github_release', 'info', `Creating GitHub release ${job.newTag}`);
          releaseUrl = await releaseGitHubService.createRelease(service.githubRepo, job.newTag, job.releaseNotes, job.releaseHeadSha);
          await this.append(jobId, 'github_release', 'success', `Published ${job.newTag}`);
        }
        job = await prisma.releaseJob.update({ where: { id: jobId }, data: { releaseUrl } });
      }

      if (!job.slackThreadTs) {
        const audit = await releaseGitHubAuditService.auditSince(service.githubRepo, job.latestTag, job.releaseHeadSha ?? undefined);
        const start = await releaseSlackService.postStart(service.displayName, job.newTag, audit.pending.length);
        if (start.ok && start.ts) {
          job = await prisma.releaseJob.update({
            where: { id: jobId },
            data: { slackThreadTs: start.ts, slackChannel: start.channel ?? null },
          });
          await this.append(jobId, 'slack_start', 'success', 'Posted start message to Slack');
        } else {
          await this.append(jobId, 'slack_start', 'skip', `Slack start skipped: ${start.error || 'not configured'}`);
        }
      }

      if (!job.ciStatus) {
        await this.append(jobId, 'ci', 'info', `Waiting for ${service.ciWorkflow} (about 6-7 minutes)`);
        if (job.slackThreadTs) {
          await releaseSlackService.postThread(job.slackThreadTs, `Waiting for ${service.ciSlackLabel} on ${job.newTag}.`);
        }
        const ci = await releaseGitHubService.waitForCi(service.githubRepo, job.newTag, service.ciWorkflow);
        job = await prisma.releaseJob.update({
          where: { id: jobId },
          data: { ciStatus: ci.status, ciRunUrl: ci.runUrl },
        });
        const ciType: ReleaseProgressType = ci.status === 'Passed' ? 'success' : 'error';
        await this.append(jobId, 'ci', ciType, `CI ${ci.status}`);
        if (job.slackThreadTs) {
          await releaseSlackService.postThread(job.slackThreadTs, `${service.ciSlackLabel}: ${ci.status}`);
        }
        if (ci.status === 'Failed' || ci.status === 'Timed out') {
          throw new Error(`CI ${ci.status}`);
        }
      }

      if (!job.bumpOutcome) {
        await this.append(jobId, 'argocd_bump', 'info', 'Waiting for the ArgoCD version-bump pull request');
        await this.notifyThread(jobId, job.slackThreadTs, `Waiting for the ArgoCD version-bump pull request after ${service.ciSlackLabel}.`);
        const bump = await releaseArgocdService.waitForVersionBump(service.key, job.argocdTag, job.startedAt ?? undefined, {
          onPrFound: async (prUrl) => {
            await this.append(jobId, 'argocd_bump', 'success', `GitOps pull request opened: ${prUrl}`);
            await this.notifyThread(jobId, job.slackThreadTs, `GitOps pull request opened: ${prUrl}`);
          },
        });
        const bumpData = {
          bumpOutcome: bump.outcome,
          argocdPrUrl: bump.prUrl,
          argocdPrNumber: bump.prNumber,
        };
        if (bump.merged && !job.mergeQueuedAt) {
          // The version-bump PR was already merged by the time we observed it, but this
          // job never recorded @lfx-one's approval or a merge-queue entry (e.g. a
          // manual/out-of-band merge). Proceeding would bypass the approval gate.
          const message = 'GitOps pull request merged without recorded @lfx-one approval or merge-queue entry';
          const updated = await this.updateIfLeaseOwner(jobId, {
            ...bumpData,
            status: 'failed',
            errorMessage: message,
            completedAt: new Date(),
            leaseOwner: null,
            leaseExpiresAt: null,
          });
          if (updated) {
            await this.append(jobId, 'approval', 'error', message);
            this.emitStatus(jobId, ReleaseJobStatus.FAILED);
            releaseJobEmitter.emit(jobId, { type: 'error', data: message });
            releaseJobEmitter.emit(jobId, { type: 'done', data: '' });
          }
          return;
        }
        const updated = await this.updateIfLeaseOwner(jobId, { ...bumpData, status: 'waiting_for_approval', leaseOwner: null, leaseExpiresAt: null });
        if (!updated) {
          return;
        }
        job = updated;
        if (bump.outcome === 'reused') {
          await this.append(jobId, 'argocd_bump', 'success', `Reused ${bump.prUrl}`);
        }
        if (!bump.merged) {
          await this.append(jobId, 'approval', 'info', 'Waiting for @lfx-one. Changelog will enqueue the merge queue after approval.');
          this.emitStatus(jobId, ReleaseJobStatus.WAITING_FOR_APPROVAL);
          return;
        }
      }

      if (job.argocdPrNumber) {
        const pr = await releaseGitHubService.getPull(ARGOCD_REPO, job.argocdPrNumber);
        if (pr.merged && !job.mergeQueuedAt) {
          // Same out-of-band merge check as the pre-bump guard above. A retry re-enters
          // with bumpOutcome already set (so the earlier guard is skipped) and would
          // otherwise accept a PR merged without @lfx-one approval by falling through
          // to finishAfterMerge below.
          const message = 'GitOps pull request merged without recorded @lfx-one approval or merge-queue entry';
          const updated = await this.updateIfLeaseOwner(jobId, {
            status: 'failed',
            errorMessage: message,
            completedAt: new Date(),
            leaseOwner: null,
            leaseExpiresAt: null,
          });
          if (updated) {
            await this.append(jobId, 'approval', 'error', message);
            this.emitStatus(jobId, ReleaseJobStatus.FAILED);
            releaseJobEmitter.emit(jobId, { type: 'error', data: message });
            releaseJobEmitter.emit(jobId, { type: 'done', data: '' });
          }
          return;
        }
        if (!pr.merged) {
          if (job.status !== 'waiting_for_approval') {
            const updated = await this.updateIfLeaseOwner(jobId, { status: 'waiting_for_approval', leaseOwner: null, leaseExpiresAt: null });
            if (updated) {
              this.emitStatus(jobId, ReleaseJobStatus.WAITING_FOR_APPROVAL);
            }
          }
          return;
        }
      }

      await this.finishAfterMerge(jobId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      serverLogger.error({ err: error, jobId }, 'Release job failed');
      const failed = await this.updateIfLeaseOwner(jobId, {
        status: 'failed',
        errorMessage: message,
        completedAt: new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
      });
      if (!failed) {
        return;
      }
      await this.append(jobId, 'plan', 'error', message);
      this.emitStatus(jobId, ReleaseJobStatus.FAILED);
      releaseJobEmitter.emit(jobId, { type: 'error', data: message });
      releaseJobEmitter.emit(jobId, { type: 'done', data: '' });
    }
  }

  private emitStatus(jobId: string, status: ReleaseJobStatus): void {
    releaseJobEmitter.emit(jobId, { type: 'status', data: { status } });
  }
}

export const releaseWorkflowService = new ReleaseWorkflowService();
