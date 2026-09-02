// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Prisma } from '@prisma/client';

import { getPrismaClient } from './prisma.service';
import { releasableCatalogService } from './releasable-catalog.service';
import { ARGOCD_REPO, releaseArgocdService } from './release-argocd.service';
import { releaseAuthService } from './release-auth.service';
import { releaseGitHubAuditService, computeNextTag } from './release-github-audit.service';
import { releaseGitHubService } from './release-github.service';
import { releaseJobEmitter } from './release-job-emitter.service';
import { releaseSlackService } from './release-slack.service';
import { isArgocdSyncEnabled, releaseSyncService } from './release-sync.service';
import { serverLogger } from '../server-logger';

import { ReleaseJobStatus } from '@lfx-changelog/shared';

import type { ReleaseProgressLine, ReleaseProgressType } from '@lfx-changelog/shared';
import type { ReleaseJob } from '@prisma/client';

const running = new Set<string>();

export class ReleaseWorkflowService {
  public async startJob(input: {
    serviceKey: string;
    notes: string;
    newTag?: string;
    requesterId: string;
  }): Promise<ReleaseJob> {
    const service = releasableCatalogService.require(input.serviceKey);
    const productId = await releaseAuthService.mappedProductId(service.key);
    const audit = await releaseGitHubAuditService.audit(service.githubRepo);
    if (audit.error) {
      throw new Error(audit.error);
    }
    if (audit.pending.length === 0) {
      throw new Error('Nothing to release');
    }
    const tags = computeNextTag(audit.latestTag);
    const newTag = input.newTag || tags.newTag;

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
    const updated = await prisma.releaseJob.update({
      where: { id: jobId },
      data: { status: 'running', errorMessage: null, startedAt: job.startedAt ?? new Date() },
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
    if (job.status !== 'waiting_for_approval') {
      throw new Error('Job is not waiting for approval');
    }
    const updated = await prisma.releaseJob.update({
      where: { id: jobId },
      data: { status: 'cancelled', cancelledById, completedAt: new Date() },
    });
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

  public kickoff(jobId: string): void {
    if (running.has(jobId)) {
      return;
    }
    running.add(jobId);
    void this.run(jobId).finally(() => running.delete(jobId));
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

  public async finishAfterMerge(jobId: string): Promise<void> {
    const prisma = getPrismaClient();
    let job = await prisma.releaseJob.findUniqueOrThrow({ where: { id: jobId } });
    const service = releasableCatalogService.require(job.serviceKey);

    job = await prisma.releaseJob.update({ where: { id: jobId }, data: { status: 'running' } });
    this.emitStatus(jobId, ReleaseJobStatus.RUNNING);
    const mergeLine = job.bumpOutcome === 'already_current' ? 'Pins already current. No GitOps pull request.' : 'GitOps pull request merged';
    await this.append(jobId, 'merge', 'success', mergeLine);
    const syncEnabled = isArgocdSyncEnabled();
    if (job.slackThreadTs) {
      const slackMerge = syncEnabled
        ? job.bumpOutcome === 'already_current'
          ? `${mergeLine} Requesting deploy sync.`
          : 'Requesting deploy sync.'
        : `${mergeLine} Changelog is not requesting an Argo CD sync.`;
      await releaseSlackService.postThread(job.slackThreadTs, slackMerge);
    }

    const syncIntro = syncEnabled
      ? 'Requesting Argo CD sync per environment'
      : 'Skipping Argo CD sync. Deploy apply is left to the cluster webhook.';
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
      await this.append(jobId, 'sync', type, `${sync.environment}: ${sync.requestStatus}${sync.requestError ? ` (${sync.requestError})` : ''}`, sync.environment);
    }

    const syncLine = syncs.map((row) => `${row.environment}=${row.requestStatus}`).join(', ');
    if (job.slackThreadTs) {
      const audit = await releaseGitHubAuditService.audit(service.githubRepo);
      const summary = releaseSlackService.buildSummary({
        displayName: service.displayName,
        newTag: job.newTag,
        prCount: audit.pending.length,
        pendingLines: audit.pending.map((pr) => `- #${pr.number} ${pr.title} @${pr.author}`).join('\n') || 'See GitHub release notes.',
        releaseUrl: job.releaseUrl || '',
        ciStatus: job.ciStatus || 'unknown',
        ciRunUrl: job.ciRunUrl || `https://github.com/${service.githubRepo}/actions`,
        ciLabel: service.ciSlackLabel,
        argocdLine: job.argocdPrUrl ? `<${job.argocdPrUrl}|GitOps PR>` : job.bumpOutcome === 'already_current' ? 'already current' : 'missing',
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

    await prisma.releaseJob.update({
      where: { id: jobId },
      data: { status: 'completed', completedAt: new Date() },
    });
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
        await this.append(jobId, 'github_release', 'info', `Creating GitHub release ${job.newTag}`);
        const releaseUrl = await releaseGitHubService.createRelease(service.githubRepo, job.newTag, job.releaseNotes);
        job = await prisma.releaseJob.update({ where: { id: jobId }, data: { releaseUrl } });
        await this.append(jobId, 'github_release', 'success', `Published ${job.newTag}`);
      }

      if (!job.slackThreadTs) {
        const audit = await releaseGitHubAuditService.audit(service.githubRepo);
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
        let ciType: ReleaseProgressType = 'error';
        if (ci.status === 'Passed') {
          ciType = 'success';
        } else if (ci.status.startsWith('Warning')) {
          ciType = 'skip';
        }
        await this.append(jobId, 'ci', ciType, `CI ${ci.status}`);
        if (job.slackThreadTs) {
          await releaseSlackService.postThread(job.slackThreadTs, `${service.ciSlackLabel}: ${ci.status}`);
        }
        if (ci.status === 'Failed' || ci.status === 'Timed out') {
          throw new Error(`CI ${ci.status}`);
        }
      }

      if (!job.bumpOutcome) {
        await this.append(jobId, 'argocd_bump', 'info', 'Watching for the GitOps version-bump job');
        await this.notifyThread(jobId, job.slackThreadTs, `Watching for the GitOps version-bump job after ${service.ciSlackLabel}.`);
        const bump = await releaseArgocdService.waitForVersionBump(service.key, job.argocdTag, job.startedAt ?? undefined, {
          onRunDetected: async (runUrl) => {
            await this.append(jobId, 'argocd_bump', 'info', `GitOps version-bump job is running: ${runUrl}`);
            await this.notifyThread(jobId, job.slackThreadTs, `GitOps version-bump job is running: ${runUrl}`);
          },
          onPrFound: async (prUrl) => {
            await this.append(jobId, 'argocd_bump', 'success', `GitOps pull request opened: ${prUrl}`);
            await this.notifyThread(jobId, job.slackThreadTs, `GitOps pull request opened: ${prUrl}`);
          },
        });
        job = await prisma.releaseJob.update({
          where: { id: jobId },
          data: {
            bumpOutcome: bump.outcome,
            bumpRunUrl: bump.runUrl,
            argocdPrUrl: bump.prUrl,
            argocdPrNumber: bump.prNumber,
            status: bump.outcome === 'already_current' || bump.merged ? 'running' : 'waiting_for_approval',
          },
        });
        if (bump.outcome === 'already_current') {
          await this.append(jobId, 'argocd_bump', 'success', 'Pins already current. No pull request.');
          await this.notifyThread(jobId, job.slackThreadTs, 'GitOps pins already current. No pull request.');
        } else if (bump.outcome === 'reused') {
          await this.append(jobId, 'argocd_bump', 'success', `Reused ${bump.prUrl}`);
        }
        if (bump.outcome !== 'already_current' && !bump.merged) {
          await this.append(jobId, 'approval', 'info', 'Waiting for @lfx-one. Changelog will enqueue the merge queue after approval.');
          this.emitStatus(jobId, ReleaseJobStatus.WAITING_FOR_APPROVAL);
          return;
        }
      }

      if (job.argocdPrNumber) {
        const pr = await releaseGitHubService.getPull(ARGOCD_REPO, job.argocdPrNumber);
        if (!pr.merged) {
          if (job.status !== 'waiting_for_approval') {
            await prisma.releaseJob.update({ where: { id: jobId }, data: { status: 'waiting_for_approval' } });
            this.emitStatus(jobId, ReleaseJobStatus.WAITING_FOR_APPROVAL);
          }
          return;
        }
      }

      await this.finishAfterMerge(jobId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      serverLogger.error({ err: error, jobId }, 'Release job failed');
      await prisma.releaseJob.update({
        where: { id: jobId },
        data: { status: 'failed', errorMessage: message, completedAt: new Date() },
      });
      await this.append(jobId, 'plan', 'error', message);
      this.emitStatus(jobId, ReleaseJobStatus.FAILED);
      releaseJobEmitter.emit(jobId, { type: 'error', data: message });
      releaseJobEmitter.emit(jobId, { type: 'done', data: '' });
    }
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

  private emitStatus(jobId: string, status: ReleaseJobStatus): void {
    releaseJobEmitter.emit(jobId, { type: 'status', data: { status } });
  }
}

export const releaseWorkflowService = new ReleaseWorkflowService();
