// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import jwt from 'jsonwebtoken';

import { serverLogger } from '../server-logger';

const GITHUB_API_BASE = 'https://api.github.com';
const CI_POLL_ATTEMPTS = 60;
const CI_POLL_INTERVAL_MS = 5_000;
const CI_WATCH_TIMEOUT_MS = 420_000;
// Refresh this far ahead of GitHub's stated expiry so a token handed out for a request
// doesn't expire mid-flight.
const TOKEN_EXPIRY_SAFETY_MS = 60_000;

export class ReleaseGitHubService {
  private cachedToken: { token: string; expiresAt: number } | null = null;

  public async getInstallationToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.token;
    }

    const installationId = Number(process.env['RELEASE_GITHUB_INSTALLATION_ID'] || '');
    if (!Number.isFinite(installationId) || installationId <= 0) {
      throw new Error('RELEASE_GITHUB_INSTALLATION_ID is not set');
    }

    const appJwt = this.appJwt();
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
      serverLogger.error({ status: response.status, body }, 'Release GitHub installation token failed');
      throw new Error(`GitHub installation token failed: ${response.status}`);
    }
    const data = (await response.json()) as { token: string; expires_at?: string };
    const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() - TOKEN_EXPIRY_SAFETY_MS : Date.now();
    this.cachedToken = { token: data.token, expiresAt };
    return data.token;
  }

  public async createRelease(repo: string, tag: string, notes: string, headSha?: string | null): Promise<string> {
    const token = await this.getInstallationToken();
    const response = await fetch(`${GITHUB_API_BASE}/repos/${repo}/releases`, {
      method: 'POST',
      headers: {
        ...this.headers(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tag_name: tag,
        name: tag,
        body: notes,
        target_commitish: headSha || 'main',
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Create GitHub release failed: ${response.status} ${body}`);
    }
    const data = (await response.json()) as { html_url?: string };
    if (!data.html_url) {
      throw new Error('Create GitHub release returned no URL');
    }
    return data.html_url;
  }

  public async getReleaseByTag(repo: string, tag: string): Promise<{ htmlUrl: string; body: string } | null> {
    const token = await this.getInstallationToken();
    const response = await fetch(`${GITHUB_API_BASE}/repos/${repo}/releases/tags/${tag}`, {
      headers: this.headers(token),
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Get GitHub release failed: ${response.status}`);
    }
    const data = (await response.json()) as { html_url?: string; body?: string };
    if (!data.html_url) {
      throw new Error('Get GitHub release returned no URL');
    }
    return { htmlUrl: data.html_url, body: data.body || '' };
  }

  public async waitForCi(repo: string, tag: string, workflowName: string): Promise<{ status: string; runUrl: string }> {
    const token = await this.getInstallationToken();
    const workflowId = await this.resolveWorkflowId(repo, workflowName, token);
    if (!workflowId) {
      throw new Error(`CI workflow "${workflowName}" not found in ${repo}`);
    }

    let runId: number | null = null;
    for (let attempt = 1; attempt <= CI_POLL_ATTEMPTS; attempt++) {
      runId = await this.findWorkflowRun(repo, tag, workflowId, token);
      if (runId) {
        break;
      }
      await this.sleep(CI_POLL_INTERVAL_MS);
    }

    if (!runId) {
      throw new Error(`CI run for "${workflowName}" on ${tag} was not found in ${repo} after ${CI_POLL_ATTEMPTS} attempts`);
    }

    const runUrl = `https://github.com/${repo}/actions/runs/${runId}`;
    const deadline = Date.now() + CI_WATCH_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const run = await this.getWorkflowRun(repo, runId, token);
      if (run.status === 'completed') {
        return { status: run.conclusion === 'success' ? 'Passed' : 'Failed', runUrl };
      }
      await this.sleep(CI_POLL_INTERVAL_MS);
    }
    return { status: 'Timed out', runUrl };
  }

  public async findPullByHead(
    repo: string,
    headBranch: string
  ): Promise<{ number: number; url: string; state: string; merged: boolean; createdAt: string | null } | null> {
    const owner = repo.split('/')[0];
    const open = await this.listPullsByHead(repo, owner, headBranch, 'open');
    if (open) {
      return open;
    }
    return this.listPullsByHead(repo, owner, headBranch, 'closed');
  }

  public async getPull(
    repo: string,
    pullNumber: number
  ): Promise<{
    number: number;
    url: string;
    state: string;
    merged: boolean;
    mergeableState: string | null;
    nodeId: string;
    headSha: string | null;
    createdAt: string | null;
  }> {
    const token = await this.getInstallationToken();
    const response = await fetch(`${GITHUB_API_BASE}/repos/${this.encodeRepo(repo)}/pulls/${encodeURIComponent(pullNumber)}`, {
      headers: this.headers(token),
    });
    if (!response.ok) {
      throw new Error(`Get pull request failed: ${response.status}`);
    }
    const data = (await response.json()) as {
      number: number;
      html_url: string;
      state: string;
      merged?: boolean;
      mergeable_state?: string;
      node_id?: string;
      head?: { sha?: string };
      created_at?: string;
    };
    if (!data.node_id) {
      throw new Error('Get pull request returned no node_id');
    }
    return {
      number: data.number,
      url: data.html_url,
      state: data.state,
      merged: Boolean(data.merged),
      mergeableState: data.mergeable_state ?? null,
      nodeId: data.node_id,
      headSha: data.head?.sha ?? null,
      createdAt: data.created_at ?? null,
    };
  }

  /**
   * Returns whether any commit status on `sha` is in a terminal-failure state
   * (`failure` or `error`). Used by the approval poller to fail a job whose
   * ArgoCD pull request's CI has failed. Returns `null` if the status cannot
   * be fetched (permission errors, transient 5xx), so the caller can treat it
   * as "unknown" rather than "passing".
   */
  public async getFailingCheckStatus(repo: string, sha: string): Promise<{ failed: boolean; url: string | null } | null> {
    const token = await this.getInstallationToken();
    const response = await fetch(`${GITHUB_API_BASE}/repos/${this.encodeRepo(repo)}/commits/${encodeURIComponent(sha)}/status`, {
      headers: this.headers(token),
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { state?: string; statuses?: { state?: string; target_url?: string | null }[] };
    const failed = data.state === 'failure' || data.state === 'error';
    if (!failed) {
      return { failed: false, url: null };
    }
    const firstFailingUrl = (data.statuses ?? []).find((entry) => entry.state === 'failure' || entry.state === 'error')?.target_url ?? null;
    return { failed: true, url: firstFailingUrl };
  }

  /**
   * `expectedHeadOid` closes the check-to-enqueue race: GitHub's mutation refuses to enqueue
   * if the PR's current head differs from the SHA we approved against, so a commit pushed
   * after our approval check cannot slip into the merge queue on a stale approval.
   */
  public async enqueueMergeQueue(
    repo: string,
    pullNumber: number,
    expectedHeadOid?: string | null
  ): Promise<{ alreadyQueued: boolean; position: number | null }> {
    const [owner, name] = repo.split('/');
    if (!owner || !name) {
      throw new Error(`Invalid repo: ${repo}`);
    }
    const state = await this.mergeQueueState(owner, name, pullNumber);
    if (state.queued) {
      return { alreadyQueued: true, position: state.position };
    }
    if (!state.nodeId) {
      throw new Error(`Pull request ${pullNumber} has no GraphQL id`);
    }
    try {
      const data = await this.graphql<{
        enqueuePullRequest?: { mergeQueueEntry?: { position?: number | null } | null };
      }>(
        `mutation Enqueue($prId: ID!, $expectedHeadOid: GitObjectID) {
          enqueuePullRequest(input: { pullRequestId: $prId, expectedHeadOid: $expectedHeadOid }) {
            mergeQueueEntry { position }
          }
        }`,
        { prId: state.nodeId, expectedHeadOid: expectedHeadOid ?? null }
      );
      return { alreadyQueued: false, position: data.enqueuePullRequest?.mergeQueueEntry?.position ?? null };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/already in the queue/i.test(message)) {
        return { alreadyQueued: true, position: state.position };
      }
      throw error;
    }
  }

  public async listReviews(repo: string, pullNumber: number): Promise<{ user: string; state: string; commitId: string | null }[]> {
    const token = await this.getInstallationToken();
    const reviews: { user: string; state: string; commitId: string | null }[] = [];
    for (let page = 1; ; page++) {
      const response = await fetch(
        `${GITHUB_API_BASE}/repos/${this.encodeRepo(repo)}/pulls/${encodeURIComponent(pullNumber)}/reviews?per_page=100&page=${page}`,
        {
          headers: this.headers(token),
        }
      );
      if (!response.ok) {
        throw new Error(`List reviews failed: ${response.status}`);
      }
      const data = (await response.json()) as { user?: { login?: string }; state?: string; commit_id?: string | null }[];
      for (const review of data) {
        reviews.push({ user: review.user?.login || '', state: review.state || '', commitId: review.commit_id ?? null });
      }
      if (data.length < 100) {
        break;
      }
    }
    return reviews;
  }

  public async requiredChecksPassed(repo: string, pullNumber: number): Promise<boolean> {
    const token = await this.getInstallationToken();
    const prResponse = await fetch(`${GITHUB_API_BASE}/repos/${repo}/pulls/${pullNumber}`, {
      headers: this.headers(token),
    });
    if (!prResponse.ok) {
      return false;
    }
    const pr = (await prResponse.json()) as { head?: { sha?: string }; mergeable_state?: string };
    if (pr.mergeable_state === 'blocked' || pr.mergeable_state === 'dirty') {
      return false;
    }
    const sha = pr.head?.sha;
    if (!sha) {
      return false;
    }
    const statusResponse = await fetch(`${GITHUB_API_BASE}/repos/${repo}/commits/${sha}/status`, {
      headers: this.headers(token),
    });
    if (!statusResponse.ok) {
      return pr.mergeable_state === 'clean' || pr.mergeable_state === 'unstable' || pr.mergeable_state === 'has_hooks';
    }
    const status = (await statusResponse.json()) as { state?: string };
    return status.state !== 'failure' && status.state !== 'error';
  }

  private async listPullsByHead(
    repo: string,
    owner: string | undefined,
    headBranch: string,
    state: 'open' | 'closed'
  ): Promise<{ number: number; url: string; state: string; merged: boolean; createdAt: string | null } | null> {
    if (!owner) {
      return null;
    }
    const token = await this.getInstallationToken();
    const head = encodeURIComponent(`${owner}:${headBranch}`);
    const response = await fetch(`${GITHUB_API_BASE}/repos/${repo}/pulls?head=${head}&state=${state}&per_page=5`, {
      headers: this.headers(token),
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as {
      number: number;
      html_url: string;
      state: string;
      merged_at?: string | null;
      created_at?: string;
    }[];
    const first = data[0];
    if (!first) {
      return null;
    }
    return {
      number: first.number,
      url: first.html_url,
      state: first.state,
      merged: Boolean(first.merged_at),
      createdAt: first.created_at ?? null,
    };
  }

  private async findWorkflowRun(repo: string, tag: string, workflowId: number, token: string): Promise<number | null> {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${repo}/actions/workflows/${workflowId}/runs?per_page=20`, {
      headers: this.headers(token),
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { workflow_runs?: { id: number; head_branch?: string }[] };
    const match = (data.workflow_runs ?? []).find((run) => run.head_branch === tag || run.head_branch === `refs/tags/${tag}`);
    return match?.id ?? null;
  }

  /**
   * GitHub's workflow_id path parameter accepts a numeric ID or the workflow
   * file's basename (e.g. "release.yml") -- never the workflow's display
   * `name:`. The release catalog stores the human-readable display name, so
   * resolve it to an ID via the list-workflows endpoint before querying runs.
   */
  private async resolveWorkflowId(repo: string, workflowName: string, token: string): Promise<number | null> {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${repo}/actions/workflows?per_page=100`, {
      headers: this.headers(token),
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { workflows?: { id: number; name?: string; path?: string }[] };
    const match = (data.workflows ?? []).find((workflow) => workflow.name === workflowName || workflow.path?.endsWith(`/${workflowName}`));
    return match?.id ?? null;
  }

  private async getWorkflowRun(repo: string, runId: number, token: string): Promise<{ status: string; conclusion: string | null }> {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${repo}/actions/runs/${runId}`, {
      headers: this.headers(token),
    });
    if (!response.ok) {
      throw new Error(`Get workflow run failed: ${response.status}`);
    }
    return (await response.json()) as { status: string; conclusion: string | null };
  }

  private appJwt(): string {
    const appId = process.env['RELEASE_GITHUB_APP_ID'] || process.env['GITHUB_APP_ID'] || '';
    const privateKey = (process.env['RELEASE_GITHUB_PRIVATE_KEY'] || process.env['GITHUB_PRIVATE_KEY'] || '').replace(/\\n/g, '\n');
    if (!appId || !privateKey) {
      throw new Error('Release GitHub App credentials are not configured');
    }
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign({ iat: now - 60, exp: now + 600, iss: appId }, privateKey, { algorithm: 'RS256' });
  }

  private async mergeQueueState(owner: string, name: string, pullNumber: number): Promise<{ nodeId: string | null; queued: boolean; position: number | null }> {
    const data = await this.graphql<{
      repository?: {
        pullRequest?: {
          id?: string;
          mergeQueueEntry?: { position?: number | null } | null;
        } | null;
      } | null;
    }>(
      `query MergeQueueState($owner: String!, $name: String!, $number: Int!) {
        repository(owner: $owner, name: $name) {
          pullRequest(number: $number) {
            id
            mergeQueueEntry { position }
          }
        }
      }`,
      { owner, name, number: pullNumber }
    );
    const pr = data.repository?.pullRequest;
    return {
      nodeId: pr?.id ?? null,
      queued: Boolean(pr?.mergeQueueEntry),
      position: pr?.mergeQueueEntry?.position ?? null,
    };
  }

  private async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const token = await this.getInstallationToken();
    const response = await fetch(`${GITHUB_API_BASE}/graphql`, {
      method: 'POST',
      headers: {
        ...this.headers(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });
    const payload = (await response.json()) as { data?: T; errors?: { message?: string }[] };
    if (!response.ok || payload.errors?.length) {
      const message =
        payload.errors
          ?.map((entry) => entry.message)
          .filter(Boolean)
          .join('; ') || `GraphQL failed: ${response.status}`;
      throw new Error(message);
    }
    if (!payload.data) {
      throw new Error('GraphQL returned no data');
    }
    return payload.data;
  }

  private encodeRepo(repo: string): string {
    return repo.split('/').map(encodeURIComponent).join('/');
  }

  private headers(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const releaseGitHubService = new ReleaseGitHubService();
