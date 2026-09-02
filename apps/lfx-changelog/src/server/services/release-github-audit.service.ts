// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { releaseGitHubService } from './release-github.service';
import { serverLogger } from '../server-logger';

import type { PendingChange } from '@lfx-changelog/shared';

const GITHUB_API_BASE = 'https://api.github.com';

export interface ServiceAudit {
  latestTag: string;
  publishedAt: string | null;
  pending: PendingChange[];
  error: string | null;
}

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
      const pending = latest.publishedAt ? await this.fetchPendingPrs(githubRepo, latest.publishedAt, token) : [];
      const value: ServiceAudit = {
        latestTag: latest.tagName,
        publishedAt: latest.publishedAt,
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
        pending: [],
        error: message,
      };
    }
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

  private async fetchPendingPrs(repo: string, sinceIso: string, token: string): Promise<PendingChange[]> {
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
        updated_at: string;
        user?: { login?: string };
      }[];
      if (body.length === 0) {
        break;
      }
      for (const pr of body) {
        if (pr.merged_at && pr.merged_at > sinceIso) {
          pending.push({
            number: pr.number,
            title: pr.title,
            author: pr.user?.login || '',
            mergedAt: pr.merged_at,
          });
        }
      }
      // Sorted by last-updated descending: once a page's oldest update predates the release, no later page can hold a newer merge.
      const oldestUpdatedAt = body[body.length - 1]?.updated_at;
      if (oldestUpdatedAt && oldestUpdatedAt <= sinceIso) {
        break;
      }
    }
    return pending;
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
