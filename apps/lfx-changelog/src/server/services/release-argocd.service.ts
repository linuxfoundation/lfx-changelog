// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { releaseGitHubService } from './release-github.service';

export const ARGOCD_REPO = 'linuxfoundation/lfx-v2-argocd';
export const VERSION_BUMP_WORKFLOW = 'create-version-bump-pr.yml';

export type BumpOutcome = 'created' | 'reused' | 'already_current' | 'failed';

export type VersionBumpResult = {
  outcome: BumpOutcome;
  prUrl: string | null;
  prNumber: number | null;
  runUrl: string | null;
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

export function bumpRunName(serviceKey: string, tag: string): string {
  return `Bump ${serviceKey} to v${pinVersion(tag)}`;
}

export type VersionBumpHooks = {
  onRunDetected?: (runUrl: string) => Promise<void> | void;
  onPrFound?: (prUrl: string) => Promise<void> | void;
};

export class ReleaseArgocdService {
  public async waitForVersionBump(serviceKey: string, tag: string, jobStartedAt?: Date, hooks: VersionBumpHooks = {}): Promise<VersionBumpResult> {
    const branch = bumpBranch(serviceKey, tag);
    const runName = bumpRunName(serviceKey, tag);
    let lastRunUrl: string | null = null;
    let runNotified = false;
    let prNotified = false;

    for (let attempt = 1; attempt <= BUMP_POLL_ATTEMPTS; attempt++) {
      const pr = await releaseGitHubService.findPullByHead(ARGOCD_REPO, branch);
      const run = await releaseGitHubService.findWorkflowRunByName(ARGOCD_REPO, VERSION_BUMP_WORKFLOW, runName);
      lastRunUrl = run?.url ?? lastRunUrl;

      if (run?.url && !runNotified) {
        runNotified = true;
        await hooks.onRunDetected?.(run.url);
      }

      if (run?.status === 'completed' && run.conclusion === 'failure') {
        throw new Error(`GitOps version-bump job failed${run.url ? `: ${run.url}` : ''}`);
      }

      if (pr) {
        if (!prNotified) {
          prNotified = true;
          await hooks.onPrFound?.(pr.url);
        }
        const createdAt = pr.createdAt ? new Date(pr.createdAt) : null;
        const reused = Boolean(jobStartedAt && createdAt && createdAt < jobStartedAt);
        return {
          outcome: reused ? 'reused' : 'created',
          prUrl: pr.url,
          prNumber: pr.number,
          runUrl: lastRunUrl,
          merged: pr.merged,
        };
      }

      if (run?.status === 'completed' && run.conclusion === 'success') {
        return {
          outcome: 'already_current',
          prUrl: null,
          prNumber: null,
          runUrl: run.url,
          merged: true,
        };
      }

      await this.sleep(BUMP_POLL_INTERVAL_MS);
    }

    throw new Error(`GitOps version-bump pull request did not appear on ${branch}. The service may not be allowlisted, or the notify job did not dispatch.`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const releaseArgocdService = new ReleaseArgocdService();
