// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { getPrismaClient } from './prisma.service';
import { ARGOCD_REPO } from './release-argocd.service';
import { releaseGitHubService } from './release-github.service';
import { releaseWorkflowService } from './release-workflow.service';
import { serverLogger } from '../server-logger';

const LFX_ONE = 'lfx-one';
const POLL_MS = 3 * 60 * 1000;

export class ReleaseApprovalService {
  private pollerStarted = false;

  public startPoller(): void {
    if (this.pollerStarted) {
      return;
    }
    this.pollerStarted = true;
    setInterval(() => {
      void this.pollWaitingJobs();
    }, POLL_MS);
    void this.pollWaitingJobs();
  }

  public async handleReviewWebhook(payload: {
    action?: string;
    review?: { user?: { login?: string }; state?: string };
    pull_request?: { number?: number };
    repository?: { full_name?: string };
  }): Promise<void> {
    if (payload.repository?.full_name !== ARGOCD_REPO) {
      return;
    }
    const login = payload.review?.user?.login;
    const state = payload.review?.state;
    const number = payload.pull_request?.number;
    if (!number || login !== LFX_ONE || state?.toLowerCase() !== 'approved') {
      return;
    }
    await this.observePull(number);
  }

  public async handlePullRequestWebhook(payload: {
    action?: string;
    pull_request?: { number?: number; merged?: boolean };
    repository?: { full_name?: string };
  }): Promise<void> {
    if (payload.repository?.full_name !== ARGOCD_REPO) {
      return;
    }
    const number = payload.pull_request?.number;
    if (!number) {
      return;
    }
    if (payload.action === 'closed' || payload.pull_request?.merged) {
      await this.observePull(number);
    }
  }

  public async pollWaitingJobs(): Promise<void> {
    try {
      const prisma = getPrismaClient();
      const jobs = await prisma.releaseJob.findMany({
        where: { status: 'waiting_for_approval', argocdPrNumber: { not: null } },
      });
      for (const job of jobs) {
        if (job.argocdPrNumber) {
          await this.observePull(job.argocdPrNumber);
        }
      }
    } catch (error) {
      serverLogger.warn({ err: error }, 'Release approval poll skipped');
    }
  }

  private async observePull(prNumber: number): Promise<void> {
    const prisma = getPrismaClient();
    const job = await prisma.releaseJob.findFirst({
      where: { argocdPrNumber: prNumber, status: 'waiting_for_approval' },
    });
    if (!job) {
      return;
    }

    try {
      const pr = await releaseGitHubService.getPull(ARGOCD_REPO, prNumber);
      if (pr.merged) {
        await releaseWorkflowService.append(job.id, 'merge', 'success', 'Merge queue finished the GitOps pull request.');
        await releaseWorkflowService.notifyThread(job.id, job.slackThreadTs, `Merge queue finished ${pr.url}.`);
        await releaseWorkflowService.finishAfterMerge(job.id);
        return;
      }
      if (pr.state === 'closed') {
        throw new Error('GitOps pull request closed without merge');
      }

      const reviews = await releaseGitHubService.listReviews(ARGOCD_REPO, prNumber);
      const approved = reviews.some((review) => review.user === LFX_ONE && review.state.toLowerCase() === 'approved');
      if (!approved) {
        return;
      }
      if (pr.mergeableState === 'dirty') {
        throw new Error('GitOps pull request has conflicts after @lfx-one approval');
      }

      if (!job.mergeQueuedAt) {
        const claim = await prisma.releaseJob.updateMany({
          where: { id: job.id, mergeQueuedAt: null },
          data: { mergeQueuedAt: new Date() },
        });
        if (claim.count === 1) {
          await releaseWorkflowService.append(job.id, 'approval', 'success', '@lfx-one approved the GitOps pull request.');
          await releaseWorkflowService.notifyThread(job.id, job.slackThreadTs, `@lfx-one approved ${pr.url}. Adding it to the merge queue.`);
          const queued = await releaseGitHubService.enqueueMergeQueue(ARGOCD_REPO, prNumber);
          const position = queued.position != null ? ` (position ${queued.position})` : '';
          const queueLine = queued.alreadyQueued
            ? `Already in the merge queue${position}.`
            : `Added to the merge queue${position}.`;
          await releaseWorkflowService.append(job.id, 'merge', 'info', queueLine);
          await releaseWorkflowService.notifyThread(job.id, job.slackThreadTs, queueLine);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      serverLogger.error({ err: error, prNumber, jobId: job.id }, 'GitOps approval wait failed');
      await prisma.releaseJob.update({
        where: { id: job.id },
        data: { status: 'failed', errorMessage: message, completedAt: new Date() },
      });
      await releaseWorkflowService.append(job.id, 'merge', 'error', message);
    }
  }
}

export const releaseApprovalService = new ReleaseApprovalService();
