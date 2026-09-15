// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import jwt from 'jsonwebtoken';

import { GitHubApiError } from '../errors';
import { serverLogger } from '../server-logger';
import { getPrismaClient } from './prisma.service';
import { ProductService } from './product.service';

import type {
  GeneratedReleaseNotes,
  GitHubBranch,
  GitHubCommit,
  GitHubContributor,
  GitHubInstallation,
  GitHubPullRequest,
  GitHubRelease,
  GitHubRepository,
  GitHubWebhookReleasePayload,
  StoredRelease,
} from '@lfx-changelog/shared';
import type { ProductRepository as PrismaProductRepository } from '@prisma/client';
import type { CreateReleaseInput, FindAllPublicOptions, GenerateReleaseNotesInput } from '../interfaces/release.interface';

const GITHUB_API_BASE = 'https://api.github.com';

export class GitHubService {
  private get appId(): string {
    return process.env['GITHUB_APP_ID'] || '';
  }

  private get privateKey(): string {
    return (process.env['GITHUB_PRIVATE_KEY'] || '').replace(/\\n/g, '\n');
  }

  public generateAppJWT(): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now - 60,
      exp: now + 600,
      iss: this.appId,
    };
    return jwt.sign(payload, this.privateKey, { algorithm: 'RS256' });
  }

  public async getInstallationToken(installationId: number): Promise<string> {
    this.validateInstallationId(installationId);
    const appJwt = this.generateAppJWT();
    const response = await fetch(`${GITHUB_API_BASE}/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      serverLogger.error({ status: response.status, body }, 'Failed to get installation token');
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = (await response.json()) as { token: string };
    return data.token;
  }

  public async getInstallations(): Promise<GitHubInstallation[]> {
    const appJwt = this.generateAppJWT();
    const installations: GitHubInstallation[] = [];
    let page = 1;

    while (true) {
      const response = await fetch(`${GITHUB_API_BASE}/app/installations?per_page=100&page=${page}`, {
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!response.ok) {
        const body = await response.text();
        serverLogger.error({ status: response.status, body }, 'Failed to get installations');
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = (await response.json()) as GitHubInstallation[];
      installations.push(...data);

      if (data.length < 100) break;
      page++;
    }

    return installations;
  }

  public async getInstallationRepositories(installationId: number): Promise<GitHubRepository[]> {
    this.validateInstallationId(installationId);
    const token = await this.getInstallationToken(installationId);
    const repositories: GitHubRepository[] = [];
    let page = 1;

    while (true) {
      const response = await fetch(`${GITHUB_API_BASE}/installation/repositories?per_page=100&page=${page}`, {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!response.ok) {
        const body = await response.text();
        serverLogger.error({ status: response.status, body }, 'Failed to get installation repositories');
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = (await response.json()) as { repositories: GitHubRepository[] };
      repositories.push(...data.repositories);

      if (data.repositories.length < 100) break;
      page++;
    }

    return repositories;
  }

  public async getRepositoryPullRequests(installationId: number, owner: string, repo: string, repoFullName: string): Promise<GitHubPullRequest[]> {
    this.validateInstallationId(installationId);
    const token = await this.getInstallationToken(installationId);

    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls?state=open&sort=updated&direction=desc&per_page=20`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      serverLogger.error({ status: response.status, body }, 'Failed to get repository pull requests');
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const prs = (await response.json()) as GitHubPullRequest[];
    return prs.map((pr) => ({ ...pr, repoFullName }));
  }

  public async getRepositoryCommits(installationId: number, owner: string, repo: string, repoFullName: string): Promise<GitHubCommit[]> {
    this.validateInstallationId(installationId);
    const token = await this.getInstallationToken(installationId);

    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?per_page=20`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      serverLogger.error({ status: response.status, body }, 'Failed to get repository commits');
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const commits = (await response.json()) as GitHubCommit[];
    return commits.map((commit) => ({ ...commit, repoFullName }));
  }

  public async getCompareCommits(
    installationId: number,
    owner: string,
    repo: string,
    baseTag: string,
    headTag: string,
    repoFullName: string
  ): Promise<GitHubCommit[]> {
    this.validateInstallationId(installationId);
    const token = await this.getInstallationToken(installationId);

    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/compare/${encodeURIComponent(baseTag)}...${encodeURIComponent(headTag)}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      serverLogger.error({ status: response.status, body }, 'Failed to get compare commits');
      return [];
    }

    const data = (await response.json()) as { commits: GitHubCommit[] };
    return (data.commits || []).map((commit) => ({ ...commit, repoFullName }));
  }

  public async getRepositoryReleases(installationId: number, owner: string, repo: string, repoFullName: string, perPage = 20): Promise<GitHubRelease[]> {
    this.validateInstallationId(installationId);
    const token = await this.getInstallationToken(installationId);

    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/releases?per_page=${perPage}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      serverLogger.error({ status: response.status, body }, 'Failed to get repository releases');
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const releases = (await response.json()) as GitHubRelease[];
    return releases.map((release) => ({ ...release, repoFullName }));
  }

  public async getRepositoryDefaultBranch(installationId: number, owner: string, repo: string): Promise<string> {
    const data = await this.repoRequest<{ default_branch?: string }>(installationId, owner, repo, '', 'Failed to get repository');
    return data.default_branch || 'main';
  }

  public async listBranches(installationId: number, owner: string, repo: string): Promise<GitHubBranch[]> {
    const branches: GitHubBranch[] = [];
    let page = 1;

    while (true) {
      const data = await this.repoRequest<GitHubBranch[]>(installationId, owner, repo, `/branches?per_page=100&page=${page}`, 'Failed to list branches');

      branches.push(...data);

      if (data.length < 100) break;
      page++;
    }

    return branches;
  }

  public async tagExists(installationId: number, owner: string, repo: string, tagName: string): Promise<boolean> {
    try {
      await this.repoRequest<unknown>(installationId, owner, repo, `/git/ref/tags/${encodeURIComponent(tagName)}`, 'Failed to look up tag', {
        expect404: true,
      });
      return true;
    } catch (error) {
      if (error instanceof GitHubApiError && error.upstreamStatus === 404) {
        return false;
      }
      throw error;
    }
  }

  public async generateReleaseNotes(installationId: number, owner: string, repo: string, input: GenerateReleaseNotesInput): Promise<GeneratedReleaseNotes> {
    return this.repoRequest<GeneratedReleaseNotes>(installationId, owner, repo, '/releases/generate-notes', 'Failed to generate release notes', {
      body: {
        tag_name: input.tagName,
        target_commitish: input.targetCommitish,
        ...(input.previousTagName ? { previous_tag_name: input.previousTagName } : {}),
      },
    });
  }

  // GitHub creates the tag at `target_commitish` as a side effect, so this is the only place the
  // app writes a git ref — the App installation needs Contents: write.
  public async createRelease(installationId: number, owner: string, repo: string, input: CreateReleaseInput): Promise<GitHubRelease> {
    const release = await this.repoRequest<GitHubRelease>(installationId, owner, repo, '/releases', 'Failed to create release', {
      body: {
        tag_name: input.tagName,
        target_commitish: input.targetCommitish,
        name: input.name,
        body: input.body,
        draft: false,
        prerelease: input.prerelease ?? false,
      },
    });

    serverLogger.info({ owner, repo, tagName: input.tagName, targetCommitish: input.targetCommitish }, 'Created GitHub release');
    return { ...release, repoFullName: `${owner}/${repo}` };
  }

  /**
   * Fetches every contributor for a repository, paginated. Anonymous (unmatched-email)
   * contributors are excluded — without a GitHub account there is nothing to key a
   * Contributor row on, and nothing to link to Slack.
   */
  public async getRepositoryContributors(installationId: number, owner: string, repo: string): Promise<GitHubContributor[]> {
    this.validateInstallationId(installationId);
    const token = await this.getInstallationToken(installationId);
    const contributors: GitHubContributor[] = [];
    let page = 1;

    while (true) {
      const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contributors?per_page=100&page=${page}`, {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      // An empty repository returns 204 with no body.
      if (response.status === 204) break;

      if (!response.ok) {
        const body = await response.text();
        serverLogger.error({ status: response.status, body, owner, repo }, 'Failed to get repository contributors');
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = (await response.json()) as unknown;
      if (!Array.isArray(data)) {
        // An empty result is taken as "this repository has no contributors" and prunes the
        // stored links, so a 2xx that isn't a list must fail loudly rather than look empty.
        serverLogger.error({ status: response.status, owner, repo }, 'GitHub contributors response was not a list');
        throw new Error(`GitHub API returned a non-list contributors response: ${response.status}`);
      }

      contributors.push(...(data as GitHubContributor[]));

      if (data.length < 100) break;
      page++;
    }

    return contributors;
  }

  /**
   * Fetches commits on the default branch since a given ISO date string, paginated up to maxResults.
   */
  public async getCommitsSince(
    installationId: number,
    owner: string,
    repo: string,
    since: string,
    repoFullName: string,
    maxResults = 500
  ): Promise<GitHubCommit[]> {
    this.validateInstallationId(installationId);
    const token = await this.getInstallationToken(installationId);
    const commits: GitHubCommit[] = [];
    let page = 1;

    while (commits.length < maxResults) {
      const perPage = Math.min(100, maxResults - commits.length);
      const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?since=${encodeURIComponent(since)}&per_page=${perPage}&page=${page}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!response.ok) {
        const body = await response.text();
        serverLogger.error({ status: response.status, body }, 'Failed to get commits since date');
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = (await response.json()) as GitHubCommit[];
      commits.push(...data.map((c) => ({ ...c, repoFullName })));

      if (data.length < perPage) break;
      page++;
    }

    return commits;
  }

  /**
   * Fetches merged pull requests since a given ISO date string, paginated up to maxResults.
   * Uses the "closed" state filter then client-side filters by merged_at >= since.
   */
  public async getMergedPullRequestsSince(
    installationId: number,
    owner: string,
    repo: string,
    since: string,
    repoFullName: string,
    maxResults = 500
  ): Promise<GitHubPullRequest[]> {
    this.validateInstallationId(installationId);
    const token = await this.getInstallationToken(installationId);
    const sinceDate = new Date(since);
    const merged: GitHubPullRequest[] = [];
    let page = 1;

    while (merged.length < maxResults) {
      const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=${page}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!response.ok) {
        const body = await response.text();
        serverLogger.error({ status: response.status, body }, 'Failed to get merged pull requests since date');
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const prs = (await response.json()) as (GitHubPullRequest & { merged_at?: string | null })[];

      // Stop paginating based on updated_at (the sort key) — not merged_at,
      // because updated_at ordering doesn't guarantee merged_at is monotonic.
      let reachedEnd = false;
      for (const pr of prs) {
        const updatedAt = pr.updated_at ? new Date(pr.updated_at as string) : null;
        if (updatedAt && updatedAt < sinceDate) {
          reachedEnd = true;
          break;
        }

        if (!pr.merged_at) continue;

        const mergedAt = new Date(pr.merged_at);
        if (mergedAt < sinceDate) continue;

        merged.push({ ...pr, merged_at: pr.merged_at, repoFullName });

        if (merged.length >= maxResults) {
          reachedEnd = true;
          break;
        }
      }

      if (reachedEnd || prs.length < 100) break;
      page++;
    }

    return merged.slice(0, maxResults);
  }

  // ── Release persistence ───────────────────────────

  public async findAllPublicReleases(options: FindAllPublicOptions = {}): Promise<StoredRelease[]> {
    const prisma = getPrismaClient();
    const limit = Math.min(Math.max(options.limit || 20, 1), 100);

    const releases = await prisma.gitHubRelease.findMany({
      where: {
        isDraft: false,
        ...(options.productId && {
          repository: { productId: options.productId },
        }),
      },
      include: {
        repository: {
          include: { product: true },
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });

    return releases.map((r) => ({
      id: r.id,
      tagName: r.tagName,
      name: r.name,
      htmlUrl: r.htmlUrl,
      body: r.body,
      isDraft: r.isDraft,
      isPrerelease: r.isPrerelease,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      authorLogin: r.authorLogin,
      authorAvatarUrl: r.authorAvatarUrl,
      repositoryFullName: r.repository.fullName,
      productId: r.repository.product.id,
      productName: r.repository.product.name,
      productSlug: r.repository.product.slug,
      productFaIcon: r.repository.product.faIcon,
    }));
  }

  public async syncReleasesForProduct(productId: string): Promise<number> {
    const productService = new ProductService();
    const repos = await productService.findRepositoriesByProductId(productId);
    serverLogger.info({ productId, repoCount: repos.length }, 'Syncing releases for product');

    let totalSynced = 0;
    for (const repo of repos) {
      try {
        const count = await this.syncReleasesForRepository(repo);
        totalSynced += count;
      } catch (error) {
        serverLogger.error({ repo: repo.fullName, error }, 'Failed to sync releases for repository');
      }
    }

    serverLogger.info({ productId, totalSynced }, 'Finished syncing releases for product');
    return totalSynced;
  }

  public async syncReleasesForRepository(repo: PrismaProductRepository): Promise<number> {
    const releases = await this.getRepositoryReleases(repo.githubInstallationId, repo.owner, repo.name, repo.fullName, 100);

    const prisma = getPrismaClient();
    let synced = 0;

    for (const release of releases) {
      await prisma.gitHubRelease.upsert({
        where: {
          repositoryId_githubId: {
            repositoryId: repo.id,
            githubId: release.id,
          },
        },
        create: {
          repositoryId: repo.id,
          githubId: release.id,
          tagName: release.tag_name,
          name: release.name,
          htmlUrl: release.html_url,
          body: release.body,
          isDraft: release.draft,
          isPrerelease: release.prerelease,
          publishedAt: release.published_at ? new Date(release.published_at) : null,
          authorLogin: release.author.login,
          authorAvatarUrl: release.author.avatar_url,
        },
        update: {
          tagName: release.tag_name,
          name: release.name,
          htmlUrl: release.html_url,
          body: release.body,
          isDraft: release.draft,
          isPrerelease: release.prerelease,
          publishedAt: release.published_at ? new Date(release.published_at) : null,
          authorLogin: release.author.login,
          authorAvatarUrl: release.author.avatar_url,
        },
      });
      synced++;
    }

    await prisma.productRepository.update({
      where: { id: repo.id },
      data: { lastSyncedAt: new Date() },
    });

    serverLogger.info({ repo: repo.fullName, synced }, 'Synced releases for repository');
    return synced;
  }

  public async upsertReleaseFromWebhook(repositoryId: string, payload: GitHubWebhookReleasePayload): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.gitHubRelease.upsert({
      where: {
        repositoryId_githubId: {
          repositoryId,
          githubId: payload.id,
        },
      },
      create: {
        repositoryId,
        githubId: payload.id,
        tagName: payload.tag_name,
        name: payload.name,
        htmlUrl: payload.html_url,
        body: payload.body,
        isDraft: payload.draft,
        isPrerelease: payload.prerelease,
        publishedAt: payload.published_at ? new Date(payload.published_at) : null,
        authorLogin: payload.author.login,
        authorAvatarUrl: payload.author.avatar_url,
      },
      update: {
        tagName: payload.tag_name,
        name: payload.name,
        htmlUrl: payload.html_url,
        body: payload.body,
        isDraft: payload.draft,
        isPrerelease: payload.prerelease,
        publishedAt: payload.published_at ? new Date(payload.published_at) : null,
        authorLogin: payload.author.login,
        authorAvatarUrl: payload.author.avatar_url,
      },
    });

    serverLogger.info({ repositoryId, githubId: payload.id, tag: payload.tag_name }, 'Upserted release from webhook');
  }

  private validateInstallationId(installationId: number): void {
    if (!Number.isInteger(installationId) || installationId <= 0) {
      throw new Error('Invalid installation ID');
    }
  }

  // Shared request path for repository-scoped release calls. A body makes it a POST. Unlike the
  // older methods above, failures become GitHubApiError so the caller keeps GitHub's status
  // instead of collapsing every fault into a 500.
  private async repoRequest<T>(
    installationId: number,
    owner: string,
    repo: string,
    path: string,
    errorMessage: string,
    options: { body?: unknown; expect404?: boolean } = {}
  ): Promise<T> {
    this.validateInstallationId(installationId);
    const { body, expect404 = false } = options;

    let response: Response;
    try {
      const token = await this.getInstallationToken(installationId);

      response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch (error) {
      // Token minting and transport faults both land here; neither carries a GitHub status.
      serverLogger.error({ err: error, owner, repo, path }, errorMessage);
      throw new GitHubApiError(errorMessage, { upstreamBody: error instanceof Error ? error.message : undefined });
    }

    if (!response.ok) {
      const text = await response.text();
      const retryAfter = response.headers.get('retry-after');
      const rateLimited = response.status === 403 && (response.headers.get('x-ratelimit-remaining') === '0' || retryAfter !== null);

      // Only a caller that treats 404 as an answer, rather than a fault, skips the error log —
      // everywhere else a 404 means the App lost access, which must stay in the audit trail.
      if (expect404 && response.status === 404) {
        serverLogger.debug({ status: response.status, owner, repo, path }, errorMessage);
      } else {
        serverLogger.error({ status: response.status, body: text, owner, repo, path, rateLimited, retryAfter }, errorMessage);
      }

      throw new GitHubApiError(errorMessage, { upstreamStatus: response.status, upstreamBody: text, rateLimited });
    }

    return response.json() as Promise<T>;
  }
}
