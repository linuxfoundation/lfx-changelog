// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { GitHubCommit, GitHubInstallation, GitHubPullRequest, GitHubRelease, GitHubRepository } from '@lfx-changelog/shared';
import jwt from 'jsonwebtoken';

import { serverLogger } from '../server-logger';

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

      // Stop paginating if we've gone past our date window
      let reachedEnd = false;
      for (const pr of prs) {
        if (!pr.merged_at) continue;
        const mergedAt = new Date(pr.merged_at);
        if (mergedAt < sinceDate) {
          reachedEnd = true;
          break;
        }
        merged.push({ ...pr, merged_at: pr.merged_at, repoFullName });
      }

      if (reachedEnd || prs.length < 100) break;
      page++;
    }

    return merged.slice(0, maxResults);
  }

  private validateInstallationId(installationId: number): void {
    if (!Number.isInteger(installationId) || installationId <= 0) {
      throw new Error('Invalid installation ID');
    }
  }
}
