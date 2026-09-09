// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { releaseGitHubService } from './release-github.service';

export const ARGOCD_REPO = 'linuxfoundation/lfx-v2-argocd';

export type BumpOutcome = 'created' | 'reused' | 'failed';

export type VersionBumpResult = {
  outcome: BumpOutcome;
  prUrl: string | null;
  prNumber: number | null;
  merged: boolean;
};

const BUMP_POLL_ATTEMPTS = 60;
const BUMP_POLL_INTERVAL_MS = 5_000;

export function pinVersion(tag: string): string {
  return tag.replace(/^v/, '');
}

export function bumpBranch(serviceKey: string, tag: string): string {
  return `bump/${serviceKey}-${pinVersion(tag)}`;
}

export type VersionBumpHooks = {
  onPrFound?: (prUrl: string) => Promise<void> | void;
};

export class ReleaseArgocdService {
  public async waitForVersionBump(serviceKey: string, tag: string, jobStartedAt?: Date, hooks: VersionBumpHooks = {}): Promise<VersionBumpResult> {
    const branch = bumpBranch(serviceKey, tag);
    let prNotified = false;

    for (let attempt = 1; attempt <= BUMP_POLL_ATTEMPTS; attempt++) {
      const pr = await releaseGitHubService.findPullByHead(ARGOCD_REPO, branch);

      // findPullByHead prefers open PRs but falls back to state=closed. A closed-unmerged
      // fallback match is a stale attempt (someone closed it without merging), and
      // returning it would route the job to waiting_for_approval where observePull will
      // immediately fail it because a closed PR cannot be approved or queued. Skip it
      // and keep polling so the version-bump workflow's next PR is picked up.
      const usablePr = pr && !(pr.state === 'closed' && !pr.merged) ? pr : null;
      if (usablePr) {
        if (!prNotified) {
          prNotified = true;
          await hooks.onPrFound?.(usablePr.url);
        }
        const createdAt = usablePr.createdAt ? new Date(usablePr.createdAt) : null;
        const reused = Boolean(jobStartedAt && createdAt && createdAt < jobStartedAt);
        return {
          outcome: reused ? 'reused' : 'created',
          prUrl: usablePr.url,
          prNumber: usablePr.number,
          merged: usablePr.merged,
        };
      }

      await this.sleep(BUMP_POLL_INTERVAL_MS);
    }

    throw new Error(`ArgoCD version-bump pull request did not appear on ${branch}. The upstream release build workflow may not have dispatched the ArgoCD notify job.`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const releaseArgocdService = new ReleaseArgocdService();
