// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { JIRA_FALSE_POSITIVE_PREFIXES } from '@lfx-changelog/shared';

import type { GitHubCommit, GitHubPullRequest } from '@lfx-changelog/shared';

type StoredRelease = { body: string | null };

type AtlassianReference = {
  type: 'jira-issue' | 'confluence-page';
  key: string;
};

const JIRA_KEY_PATTERN = /\b([A-Z][A-Z0-9_]+-\d+)\b/g;
const JIRA_URL_PATTERN = /https?:\/\/[^/]+\.atlassian\.net\/browse\/([A-Z][A-Z0-9_]+-\d+)/g;
const CONFLUENCE_URL_PATTERN = /https?:\/\/[^/]+\.atlassian\.net\/wiki\/spaces\/[^/]+\/pages\/(\d+)/g;

function isLikelyJiraKey(key: string): boolean {
  const prefix = key.split('-')[0];
  return !JIRA_FALSE_POSITIVE_PREFIXES.has(prefix);
}

function extractFromText(text: string, refs: Map<string, AtlassianReference>): void {
  for (const match of text.matchAll(JIRA_KEY_PATTERN)) {
    const key = match[1];
    if (!refs.has(`jira:${key}`) && isLikelyJiraKey(key)) {
      refs.set(`jira:${key}`, { type: 'jira-issue', key });
    }
  }

  for (const match of text.matchAll(JIRA_URL_PATTERN)) {
    const key = match[1];
    if (!refs.has(`jira:${key}`)) {
      refs.set(`jira:${key}`, { type: 'jira-issue', key });
    }
  }

  for (const match of text.matchAll(CONFLUENCE_URL_PATTERN)) {
    const pageId = match[1];
    if (!refs.has(`confluence:${pageId}`)) {
      refs.set(`confluence:${pageId}`, { type: 'confluence-page', key: pageId });
    }
  }
}

/**
 * Extracts Jira issue keys and Confluence page IDs from GitHub activity text.
 * Scans commit messages, PR titles/bodies, and release bodies.
 */
export function extractAtlassianReferences(commits: GitHubCommit[], pullRequests: GitHubPullRequest[], releases: StoredRelease[]): AtlassianReference[] {
  const refs = new Map<string, AtlassianReference>();

  for (const commit of commits) {
    extractFromText(commit.commit.message, refs);
  }

  for (const pr of pullRequests) {
    extractFromText(pr.title, refs);
    if (pr.body) extractFromText(pr.body, refs);
  }

  for (const release of releases) {
    if (release.body) extractFromText(release.body, refs);
  }

  return [...refs.values()];
}

/**
 * Formats extracted Atlassian references into a prompt section.
 * Returns empty string if no references found.
 */
export function formatAtlassianHints(references: AtlassianReference[]): string {
  if (references.length === 0) return '';

  const jiraRefs = references.filter((r) => r.type === 'jira-issue');
  const confluenceRefs = references.filter((r) => r.type === 'confluence-page');

  const lines = ['## Atlassian References Detected', ''];

  if (jiraRefs.length > 0) {
    lines.push(`Jira issues referenced in activity: ${jiraRefs.map((r) => r.key).join(', ')}`);
    lines.push('Use `getJiraIssue` to fetch context for each referenced issue.');
  }

  if (confluenceRefs.length > 0) {
    lines.push(`Confluence pages referenced: ${confluenceRefs.map((r) => r.key).join(', ')}`);
    lines.push('Use `getConfluencePage` to fetch relevant documentation context.');
  }

  lines.push('');
  return lines.join('\n');
}
