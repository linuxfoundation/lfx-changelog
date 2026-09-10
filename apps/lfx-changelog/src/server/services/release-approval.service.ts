// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { serverLogger } from '../server-logger';
import { getPrismaClient } from './prisma.service';
import { ARGOCD_REPO } from './release-argocd.service';
import { releaseGitHubService } from './release-github.service';
import { releaseWorkflowService } from './release-workflow.service';

const LFX_ONE = 'lfx-one';
const POLL_MS = 3 * 60 * 1000;
const APPROVAL_TIMEOUT_MS = 3 * 60 * 1000;

// REST `mergeable_state` values (lowercase) that mean required checks and required
// reviews are satisfied and GitHub will accept an immediate enqueue. `clean` is the
// normal ready state; `has_hooks` is clean plus a pre-receive hook; `unstable` means
// the PR is mergeable but a non-required check is failing/pending (still enqueueable).
const MERGE_READY_STATES = new Set(['clean', 'has_hooks', 'unstable']);
// States that will not become mergeable on their own; stop waiting and fail the job.
const MERGE_TERMINAL_BAD_STATES = new Set(['dirty', 'draft']);

/**
 * Errors thrown from within `observePull` that represent a permanent, GitHub-visible
 * failure state (closed PR, failed required checks, unresolvable merge conflict).
 * The catch block flips the job to `failed` only for these. Anything else is treated
 * as a transient integration hiccup (5xx, timeout, expired token) and left in
 * `waiting_for_approval` so the next poll can retry, per @copilot-pull-request-reviewer's
 * feedback that a temporary read failure should not permanently kill a release.
 */
class TerminalReleaseError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'TerminalReleaseError';
  }
}

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
        throw new TerminalReleaseError('GitOps pull request closed without merge');
      }

      // If any CI check on the ArgoCD PR has failed, the PR cannot be merged even
      // once @lfx-one approves. Fail the job now and post to Slack instead of waiting
      // out the polling window for an approval that would land on a broken build.
      if (pr.headSha) {
        const checks = await releaseGitHubService.getFailingCheckStatus(ARGOCD_REPO, pr.headSha);
        if (checks?.failed) {
          const suffix = checks.url ? ` (${checks.url})` : '';
          throw new TerminalReleaseError(`ArgoCD pull request CI failed${suffix}`);
        }
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
        await this.notifyApprovalTimeoutIfDue(job, pr.createdAt, pr.url);
        return;
      }

      // Approval alone is not enough to enqueue: GitHub's `enqueuePullRequest` mutation
      // rejects a PR whose required checks have not yet passed. Waiting for the merge
      // queue to reject us and then failing the whole job on a transient state was the
      // repeated failure mode in the Python reference implementation, so gate on
      // `mergeableState` before calling the mutation and let a not-yet-ready PR retry
      // on the next poll instead.
      const mergeState = (pr.mergeableState ?? '').toLowerCase();
      if (MERGE_TERMINAL_BAD_STATES.has(mergeState)) {
        throw new TerminalReleaseError(`GitOps pull request cannot be merged (mergeableState=${mergeState})`);
      }
      if (!MERGE_READY_STATES.has(mergeState)) {
        serverLogger.info(
          { jobId: job.id, prNumber, mergeableState: mergeState || null },
          '@lfx-one approved GitOps pull request; waiting for required checks before enqueueing'
        );
        return;
      }

      if (!job.mergeQueuedAt) {
        // Pre-claim `mergeQueuedAt` BEFORE calling GitHub. `cancel()` refuses to run
        // when `mergeQueuedAt` is set, so this pre-claim closes the previous
        // enqueue-before-claim race: a concurrent cancel that reads the job while
        // `mergeQueuedAt` is still null used to succeed even after the enqueue call
        // had already queued the PR, leaving the user believing cancel worked while
        // the deployment still shipped. We capture the exact timestamp we wrote and
        // use it to guard the rollback so, on enqueue failure, we only clear our
        // own claim (never overwrite a cancel/re-poll write that snuck in). If the
        // pre-claim wins zero rows a cancel already fired; skip the enqueue entirely.
        // `enqueueMergeQueue` is idempotent (repeated calls return alreadyQueued=true),
        // so a crash after the pre-claim but before the info logs is recoverable —
        // the next poll finds `mergeQueuedAt` set and returns without re-enqueuing.
        const claimedAt = new Date();
        const preClaim = await prisma.releaseJob.updateMany({
          where: { id: job.id, status: 'waiting_for_approval', mergeQueuedAt: null },
          data: { mergeQueuedAt: claimedAt },
        });
        if (preClaim.count !== 1) {
          return;
        }
        let queued: { alreadyQueued: boolean; position: number | null };
        try {
          queued = await releaseGitHubService.enqueueMergeQueue(ARGOCD_REPO, prNumber, pr.headSha ?? undefined);
        } catch (enqueueError) {
          // Only clear our own pre-claim: guard on the exact timestamp we wrote so
          // we don't stomp on a subsequent successful write from another poller.
          await prisma.releaseJob.updateMany({
            where: { id: job.id, mergeQueuedAt: claimedAt },
            data: { mergeQueuedAt: null },
          });
          throw enqueueError;
        }
        await releaseWorkflowService.append(job.id, 'approval', 'success', '@lfx-one approved the GitOps pull request.');
        await releaseWorkflowService.notifyThread(job.id, job.slackThreadTs, `@lfx-one approved ${pr.url}. Adding it to the merge queue.`);
        const position = queued.position != null ? ` (position ${queued.position})` : '';
        const queueLine = queued.alreadyQueued ? `Already in the merge queue${position}.` : `Added to the merge queue${position}.`;
        await releaseWorkflowService.append(job.id, 'merge', 'info', queueLine);
        await releaseWorkflowService.notifyThread(job.id, job.slackThreadTs, queueLine);
      }
    } catch (error) {
      // Only permanent failures (closed PR, failed required checks, dirty/draft state,
      // or an explicit merge-queue rejection) should transition the job to `failed`.
      // A transient GitHub outage (5xx, timeout, installation-token refresh failure)
      // during any of the reads above must not permanently kill an otherwise healthy
      // approval wait — leave the job in `waiting_for_approval` so the next poll retries.
      if (error instanceof TerminalReleaseError) {
        const message = error.message;
        serverLogger.error({ err: error, prNumber, jobId: job.id }, 'GitOps approval wait failed with terminal condition');
        const claim = await prisma.releaseJob.updateMany({
          where: { id: job.id, status: 'waiting_for_approval' },
          data: { status: 'failed', errorMessage: message, completedAt: new Date(), leaseOwner: null, leaseExpiresAt: null },
        });
        if (claim.count === 1) {
          await releaseWorkflowService.append(job.id, 'merge', 'error', message);
        }
        return;
      }
      serverLogger.error({ err: error, prNumber, jobId: job.id }, 'GitOps approval poll encountered transient error; will retry on next poll');
    }
  }

  /**
   * The lfx-one review agent is expected to auto-approve the ArgoCD version-bump
   * pull request within about 3 minutes of it opening. If that window elapses without
   * an approval, post a heads-up to the Slack thread so a human knows to check in.
   * The job stays in `waiting_for_approval` so a later approval still completes it.
   * `approvalTimeoutNotifiedAt` guards against re-posting on every poll cycle and
   * survives server restarts.
   */
  private async notifyApprovalTimeoutIfDue(
    job: { id: string; slackThreadTs: string | null; approvalTimeoutNotifiedAt: Date | null },
    prCreatedAt: string | null,
    prUrl: string
  ): Promise<void> {
    if (job.approvalTimeoutNotifiedAt) {
      return;
    }
    if (!prCreatedAt) {
      return;
    }
    const openedAt = new Date(prCreatedAt).getTime();
    if (!Number.isFinite(openedAt)) {
      return;
    }
    if (Date.now() - openedAt < APPROVAL_TIMEOUT_MS) {
      return;
    }
    const prisma = getPrismaClient();
    // Include `status: 'waiting_for_approval'` and `mergeQueuedAt: null` in the atomic
    // claim so a poller holding a stale snapshot can't post an "approval overdue" notice
    // for a job that has since been cancelled or already enqueued in the merge queue.
    // Also keeps the null-timestamp guard so at most one replica posts the notice per cycle.
    const claim = await prisma.releaseJob.updateMany({
      where: {
        id: job.id,
        status: 'waiting_for_approval',
        mergeQueuedAt: null,
        approvalTimeoutNotifiedAt: null,
      },
      data: { approvalTimeoutNotifiedAt: new Date() },
    });
    if (claim.count !== 1) {
      return;
    }
    const message = `@lfx-one has not approved ${prUrl} after 3 minutes. The review agent may need attention.`;
    await releaseWorkflowService.append(job.id, 'approval', 'info', message);
    await releaseWorkflowService.notifyThread(job.id, job.slackThreadTs, message);
  }
}

export const releaseApprovalService = new ReleaseApprovalService();
