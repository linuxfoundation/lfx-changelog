// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { categorizeActivity } from './categorize-activity.helper';

import type { GitHubCommit, GitHubPullRequest } from '@lfx-changelog/shared';
import type { ActivityCategory } from './categorize-activity.helper';

type StoredRelease = { tagName: string; name: string | null; body: string | null; repository: { fullName: string } };

const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  feature: 'Features',
  bugfix: 'Bug Fixes',
  improvement: 'Improvements',
  security: 'Security',
  deprecation: 'Deprecations',
  breaking_change: 'Breaking Changes',
  other: 'Other',
};

const CATEGORY_ORDER: ActivityCategory[] = ['breaking_change', 'feature', 'improvement', 'bugfix', 'security', 'deprecation', 'other'];

/**
 * Builds a structured, categorized context string from commits, merged PRs, and stored releases.
 * Used by the changelog agent pipeline to provide organized GitHub activity data.
 */
export function buildActivityContext(commits: GitHubCommit[], mergedPRs: GitHubPullRequest[], storedReleases: StoredRelease[]): string {
  const sections: string[] = [];

  // ── Activity Stats ──
  const repoSet = new Set<string>();
  for (const c of commits) repoSet.add(c.repoFullName);
  for (const pr of mergedPRs) repoSet.add(pr.repoFullName);

  const statsLines: string[] = [];
  if (commits.length > 0) {
    statsLines.push(`- ${commits.length} commit${commits.length === 1 ? '' : 's'} across ${repoSet.size} repositor${repoSet.size === 1 ? 'y' : 'ies'}`);
  }
  if (mergedPRs.length > 0) statsLines.push(`- ${mergedPRs.length} merged pull request${mergedPRs.length === 1 ? '' : 's'}`);
  if (storedReleases.length > 0) statsLines.push(`- ${storedReleases.length} release${storedReleases.length === 1 ? '' : 's'}`);

  if (statsLines.length > 0) {
    sections.push(`## Activity Stats\n\n${statsLines.join('\n')}`);
  }

  // ── Releases ──
  if (storedReleases.length > 0) {
    const releaseLines = storedReleases.map((r) => {
      const name = r.name || r.tagName;
      const body = r.body ? `\n${r.body.slice(0, 1000)}` : '';
      return `### ${name} (${r.tagName}) — ${r.repository.fullName}${body}`;
    });
    sections.push(`## Releases\n\n${releaseLines.join('\n\n')}`);
  }

  // ── Changes by Category (from PRs, prioritized over commits) ──
  const categorizedItems = new Map<ActivityCategory, string[]>();
  for (const cat of CATEGORY_ORDER) categorizedItems.set(cat, []);

  // Categorize merged PRs
  const prCommitMessages = new Set<string>();
  for (const pr of mergedPRs) {
    const category = categorizeActivity(pr.title);
    categorizedItems.get(category)!.push(`- ${pr.title} (${pr.repoFullName})`);
    // Track PR titles to avoid duplication with commits
    prCommitMessages.add(pr.title.toLowerCase().trim());
  }

  // Categorize commits (deduplicate against PR titles)
  for (const commit of commits) {
    const message = commit.commit.message.split('\n')[0];
    if (prCommitMessages.has(message.toLowerCase().trim())) continue;
    const category = categorizeActivity(message);
    categorizedItems.get(category)!.push(`- ${message}`);
  }

  // Build categorized sections
  const categoryLines: string[] = [];
  for (const cat of CATEGORY_ORDER) {
    const items = categorizedItems.get(cat)!;
    if (items.length > 0) {
      categoryLines.push(`### ${CATEGORY_LABELS[cat]}\n\n${items.slice(0, 30).join('\n')}`);
    }
  }

  if (categoryLines.length > 0) {
    sections.push(`## Changes by Category\n\n${categoryLines.join('\n\n')}`);
  }

  // ── Raw Commits (for reference) ──
  if (commits.length > 0) {
    const rawLines = commits
      .slice(0, 50)
      .map((c) => `- ${c.commit.message.split('\n')[0]}`)
      .join('\n');
    sections.push(`## Raw Commits (for reference)\n\n${rawLines}`);
  }

  return `# GitHub Activity Summary\n\n${sections.join('\n\n')}`;
}
