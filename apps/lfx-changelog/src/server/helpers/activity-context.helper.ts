// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { GitHubCommit, GitHubPullRequest } from '@lfx-changelog/shared';

type StoredRelease = { tagName: string; name: string | null; body: string | null; repository: { fullName: string } };

/**
 * Builds a context string for AI from commits, merged PRs, and stored releases.
 * Shared between the legacy AI pipeline and the agent pipeline.
 */
export function buildActivityContext(
  commits: GitHubCommit[],
  mergedPRs: GitHubPullRequest[],
  storedReleases: StoredRelease[]
): string {
  const sections: string[] = [];

  if (storedReleases.length > 0) {
    const releasesByRepo = new Map<string, StoredRelease[]>();
    for (const release of storedReleases) {
      const repoName = release.repository.fullName;
      const existing = releasesByRepo.get(repoName) || [];
      existing.push(release);
      releasesByRepo.set(repoName, existing);
    }
    for (const [repoName, repoReleases] of releasesByRepo) {
      const lines = repoReleases
        .map((r) => {
          const name = r.name || r.tagName;
          const body = r.body ? `\n${r.body.slice(0, 1000)}` : '';
          return `### ${name} (${r.tagName})${body}`;
        })
        .join('\n\n');
      sections.push(`## Releases: ${repoName}\n\n${lines}`);
    }
  }

  if (mergedPRs.length > 0) {
    const prsByRepo = new Map<string, GitHubPullRequest[]>();
    for (const pr of mergedPRs) {
      const existing = prsByRepo.get(pr.repoFullName) || [];
      existing.push(pr);
      prsByRepo.set(pr.repoFullName, existing);
    }
    for (const [repoName, repoPRs] of prsByRepo) {
      const lines = repoPRs
        .slice(0, 50)
        .map((pr) => `- #${pr.number}: ${pr.title} (by @${pr.user.login})`)
        .join('\n');
      sections.push(`## Merged Pull Requests: ${repoName}\n\n${lines}`);
    }
  }

  if (commits.length > 0) {
    const commitsByRepo = new Map<string, GitHubCommit[]>();
    for (const commit of commits) {
      const existing = commitsByRepo.get(commit.repoFullName) || [];
      existing.push(commit);
      commitsByRepo.set(commit.repoFullName, existing);
    }
    for (const [repoName, repoCommits] of commitsByRepo) {
      const lines = repoCommits
        .slice(0, 50)
        .map((c) => `- ${c.commit.message.split('\n')[0]}`)
        .join('\n');
      sections.push(`## Commits: ${repoName}\n\n${lines}`);
    }
  }

  return `# GitHub Activity Summary\n\n${sections.join('\n\n')}`;
}
