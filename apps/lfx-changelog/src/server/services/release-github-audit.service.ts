// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { serverLogger } from '../server-logger';
import { releaseGitHubService } from './release-github.service';

import type { PendingChange } from '@lfx-changelog/shared';
import type { ServiceAudit } from '../interfaces/release.interface';

const GITHUB_API_BASE = 'https://api.github.com';

export function computeNextTag(latestTag: string): { newTag: string; argocdTag: string } {
  const semver = /^v(\d+)\.(\d+)\.(\d+)$/.exec(latestTag);
  if (semver) {
    const major = Number(semver[1]);
    const minor = Number(semver[2]);
    const patch = Number(semver[3]);
    const newTag = `v${major}.${minor}.${patch + 1}`;
    return { newTag, argocdTag: `${major}.${minor}.${patch + 1}` };
  }

  const trailing = /(\d+)$/.exec(latestTag);
  if (trailing && trailing.index !== undefined) {
    const next = Number(trailing[1]) + 1;
    const newTag = `${latestTag.slice(0, trailing.index)}${next}`;
    return { newTag, argocdTag: newTag.replace(/^v/, '') };
  }

  const newTag = `${latestTag}-1`;
  return { newTag, argocdTag: newTag.replace(/^v/, '') };
}

export class ReleaseGitHubAuditService {
  private readonly cache = new Map<string, { expiresAt: number; value: ServiceAudit }>();
  private readonly ttlMs = 30_000;
  private readonly maxPendingPages = 20;

  public async audit(githubRepo: string, options?: { fresh?: boolean }): Promise<ServiceAudit> {
    const cached = this.cache.get(githubRepo);
    if (!options?.fresh && cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    try {
      const token = await releaseGitHubService.getInstallationToken();
      const latest = await this.fetchLatestRelease(githubRepo, token);
      const pending = await this.fetchPendingPrs(githubRepo, latest.tagName, token);
      const headSha = await this.fetchHeadSha(githubRepo, token);
      const value: ServiceAudit = {
        latestTag: latest.tagName,
        publishedAt: latest.publishedAt,
        headSha,
        pending,
        error: null,
      };
      this.cache.set(githubRepo, { expiresAt: Date.now() + this.ttlMs, value });
      return value;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      serverLogger.warn({ err: error, githubRepo }, 'Release audit failed');
      return {
        latestTag: '—',
        publishedAt: null,
        headSha: null,
        pending: [],
        error: message,
      };
    }
  }

  public async auditSince(githubRepo: string, sinceTag: string): Promise<ServiceAudit> {
    try {
      const token = await releaseGitHubService.getInstallationToken();
      const release = await this.fetchReleaseByTag(githubRepo, sinceTag, token);
      if (!release) {
        throw new Error(`Release ${sinceTag} not found in ${githubRepo}`);
      }
      const pending = await this.fetchPendingPrs(githubRepo, release.tagName, token);
      const headSha = await this.fetchHeadSha(githubRepo, token);
      return { latestTag: release.tagName, publishedAt: release.publishedAt, headSha, pending, error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      serverLogger.warn({ err: error, githubRepo, sinceTag }, 'Release audit (since tag) failed');
      return { latestTag: sinceTag, publishedAt: null, headSha: null, pending: [], error: message };
    }
  }

  private async fetchReleaseByTag(repo: string, tag: string, token: string): Promise<{ tagName: string; publishedAt: string | null } | null> {
    if (tag === 'v0.0.0') {
      return { tagName: tag, publishedAt: '1970-01-01T00:00:00Z' };
    }
    const response = await fetch(`${GITHUB_API_BASE}/repos/${repo}/releases/tags/${tag}`, {
      headers: this.headers(token),
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`GitHub release lookup failed: ${response.status}`);
    }
    const body = (await response.json()) as { tag_name?: string; published_at?: string };
    return { tagName: body.tag_name || tag, publishedAt: body.published_at ?? null };
  }

  private async fetchLatestRelease(repo: string, token: string): Promise<{ tagName: string; publishedAt: string | null }> {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${repo}/releases/latest`, {
      headers: this.headers(token),
    });
    if (response.status === 404) {
      return { tagName: 'v0.0.0', publishedAt: '1970-01-01T00:00:00Z' };
    }
    if (!response.ok) {
      throw new Error(`GitHub latest release failed: ${response.status}`);
    }
    const body = (await response.json()) as { tag_name?: string; published_at?: string };
    return { tagName: body.tag_name || 'v0.0.0', publishedAt: body.published_at ?? null };
  }

  /**
   * Windows "pending" PRs by the tag's actual position in commit history rather than the
   * release's `published_at` timestamp. A release can be tagged (and, for a draft, created)
   * at an earlier commit than when GitHub marks it published, so `published_at`-based
   * windowing can wrongly exclude PRs that merged before the tag was published but after it
   * was created — or, for a still-unpublished draft, exclude every PR by treating `published_at`
   * as absent. Comparing merge commit SHAs against the tag..main commit range is correct in both
   * cases.
   */
  private async fetchPendingPrs(repo: string, sinceTag: string, token: string): Promise<PendingChange[]> {
    const commitShas = sinceTag === 'v0.0.0' ? null : await this.fetchCommitShasSinceTag(repo, sinceTag, token);
    const pending: PendingChange[] = [];
    for (let page = 1; page <= this.maxPendingPages; page++) {
      const response = await fetch(`${GITHUB_API_BASE}/repos/${repo}/pulls?state=closed&base=main&sort=updated&direction=desc&per_page=100&page=${page}`, {
        headers: this.headers(token),
      });
      if (!response.ok) {
        throw new Error(`GitHub pending PRs failed: ${response.status}`);
      }
      const body = (await response.json()) as {
        number: number;
        title: string;
        merged_at: string | null;
        merge_commit_sha: string | null;
        user?: { login?: string };
      }[];
      if (body.length === 0) {
        break;
      }
      for (const pr of body) {
        if (!pr.merged_at) {
          continue;
        }
        if (commitShas === null || (pr.merge_commit_sha && commitShas.has(pr.merge_commit_sha))) {
          pending.push({
            number: pr.number,
            title: pr.title,
            author: pr.user?.login || '',
            mergedAt: pr.merged_at,
          });
        }
      }
      // Every commit in the tag..main range has been matched to a PR; no later page can add more.
      if (commitShas !== null && pending.length >= commitShas.size) {
        break;
      }
    }
    return pending;
  }

  private async fetchCommitShasSinceTag(repo: string, tag: string, token: string): Promise<Set<string>> {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${repo}/compare/${tag}...main`, {
      headers: this.headers(token),
    });
    if (!response.ok) {
      throw new Error(`GitHub compare failed: ${response.status}`);
    }
    const body = (await response.json()) as { commits?: { sha: string }[] };
    return new Set((body.commits ?? []).map((commit) => commit.sha));
  }

  private async fetchHeadSha(repo: string, token: string): Promise<string | null> {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${repo}/commits/main`, {
      headers: { ...this.headers(token), Accept: 'application/vnd.github.sha' },
    });
    if (!response.ok) {
      throw new Error(`GitHub head commit lookup failed: ${response.status}`);
    }
    return (await response.text()).trim() || null;
  }

  private headers(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }
}

export const releaseGitHubAuditService = new ReleaseGitHubAuditService();
