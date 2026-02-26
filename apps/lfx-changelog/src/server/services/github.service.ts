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

  private validateInstallationId(installationId: number): void {
    if (!Number.isInteger(installationId) || installationId <= 0) {
      throw new Error('Invalid installation ID');
    }
  }
}
