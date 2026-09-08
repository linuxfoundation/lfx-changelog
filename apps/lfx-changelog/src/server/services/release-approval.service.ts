// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { serverLogger } from '../server-logger';
import { getPrismaClient } from './prisma.service';
import { ARGOCD_REPO } from './release-argocd.service';
import { releaseGitHubService } from './release-github.service';
import { releaseWorkflowService } from './release-workflow.service';

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
        if (!job.mergeQueuedAt) {
          // Merged without this job ever recording @lfx-one's approval or enqueuing it
          // (e.g. a manual/out-of-band merge). Accepting it here would bypass the
          // approval gate and misreport the merge queue as having finished it.
          const message = 'GitOps pull request merged without recorded @lfx-one approval or merge-queue entry';
          const bypassClaim = await prisma.releaseJob.updateMany({
            where: { id: job.id, status: 'waiting_for_approval' },
            data: { status: 'failed', errorMessage: message, completedAt: new Date(), leaseOwner: null, leaseExpiresAt: null },
          });
          if (bypassClaim.count === 1) {
            await releaseWorkflowService.append(job.id, 'merge', 'error', message);
          }
          return;
        }
        const mergeClaim = await prisma.releaseJob.updateMany({
          where: { id: job.id, status: 'waiting_for_approval' },
          data: { status: 'running', ...releaseWorkflowService.leaseClaimFields() },
        });
        if (mergeClaim.count === 1) {
          try {
            await releaseWorkflowService.append(job.id, 'merge', 'success', 'Merge queue finished the GitOps pull request.');
            await releaseWorkflowService.notifyThread(job.id, job.slackThreadTs, `Merge queue finished ${pr.url}.`);
            await releaseWorkflowService.finishAfterMerge(job.id);
          } catch (postMergeError) {
            // The claim above already flipped status to 'running', so the outer catch's
            // 'waiting_for_approval' guard would no-op here and leave the job stuck. Fail it
            // directly against the status this block actually claimed.
            const message = postMergeError instanceof Error ? postMergeError.message : String(postMergeError);
            serverLogger.error({ err: postMergeError, prNumber, jobId: job.id }, 'Post-merge finish failed');
            const claim = await prisma.releaseJob.updateMany({
              where: { id: job.id, status: 'running' },
              data: { status: 'failed', errorMessage: message, completedAt: new Date(), leaseOwner: null, leaseExpiresAt: null },
            });
            if (claim.count === 1) {
              await releaseWorkflowService.append(job.id, 'merge', 'error', message);
            }
          }
        }
        return;
      }
      if (pr.state === 'closed') {
        throw new Error('GitOps pull request closed without merge');
      }

      const reviews = await releaseGitHubService.listReviews(ARGOCD_REPO, prNumber);
      let latestLfxOneState: string | null = null;
      // Consider only reviews pinned to the PR's current head. Without this filter, an
      // approval on an older commit remains sufficient whenever the repo has not enabled
      // stale-review dismissal, and a commit pushed after that review could be enqueued
      // without @lfx-one approving it.
      for (const review of reviews) {
        if (review.user !== LFX_ONE) {
          continue;
        }
        if (pr.headSha && review.commitId !== pr.headSha) {
          continue;
        }
        latestLfxOneState = review.state.toLowerCase();
      }
      if (latestLfxOneState !== 'approved') {
        return;
      }
      if (pr.mergeableState === 'dirty') {
        throw new Error('GitOps pull request has conflicts after @lfx-one approval');
      }

      if (!job.mergeQueuedAt) {
        // Enqueue first, then persist mergeQueuedAt in an atomic claim. Previously the
        // timestamp was written before the API call, so a crash between the two would
        // leave the job stuck: later polls skip this block on the non-null timestamp,
        // and cancel is also blocked while mergeQueuedAt is set. enqueueMergeQueue is
        // idempotent (repeated calls return alreadyQueued=true), so a retry after a
        // crash is safe. expectedHeadOid asks GitHub to reject the enqueue if the head
        // has advanced since our review check, closing the check-to-enqueue race.
        const queued = await releaseGitHubService.enqueueMergeQueue(ARGOCD_REPO, prNumber, pr.headSha ?? undefined);
        const claim = await prisma.releaseJob.updateMany({
          where: { id: job.id, status: 'waiting_for_approval', mergeQueuedAt: null },
          data: { mergeQueuedAt: new Date() },
        });
        if (claim.count === 1) {
          await releaseWorkflowService.append(job.id, 'approval', 'success', '@lfx-one approved the GitOps pull request.');
          await releaseWorkflowService.notifyThread(job.id, job.slackThreadTs, `@lfx-one approved ${pr.url}. Adding it to the merge queue.`);
          const position = queued.position != null ? ` (position ${queued.position})` : '';
          const queueLine = queued.alreadyQueued ? `Already in the merge queue${position}.` : `Added to the merge queue${position}.`;
          await releaseWorkflowService.append(job.id, 'merge', 'info', queueLine);
          await releaseWorkflowService.notifyThread(job.id, job.slackThreadTs, queueLine);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      serverLogger.error({ err: error, prNumber, jobId: job.id }, 'GitOps approval wait failed');
      const claim = await prisma.releaseJob.updateMany({
        where: { id: job.id, status: 'waiting_for_approval' },
        data: { status: 'failed', errorMessage: message, completedAt: new Date(), leaseOwner: null, leaseExpiresAt: null },
      });
      if (claim.count === 1) {
        await releaseWorkflowService.append(job.id, 'merge', 'error', message);
      }
    }
  }
}

export const releaseApprovalService = new ReleaseApprovalService();
