// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import {
  JIRA_ROADMAP_FETCH_FIELDS,
  JIRA_ROADMAP_FIELDS,
  JIRA_ROADMAP_PROJECT_KEY,
  JIRA_SITE_URL,
  ROADMAP_ACTIVE_COLUMNS,
  ROADMAP_CACHE_TTL_MS,
  ROADMAP_COMPLETED_COLUMNS,
} from '@lfx-changelog/shared';
import { serverLogger } from '../server-logger';

import type {
  JiraComment,
  JiraCommentsResponse,
  JiraIssue,
  JiraOption,
  JiraSearchResponse,
  JiraUser,
  RoadmapBoardResponse,
  RoadmapCacheEntry,
  RoadmapComment,
  RoadmapIdea,
  RoadmapPerson,
} from '@lfx-changelog/shared';

class RoadmapService {
  private activeCache: RoadmapCacheEntry | null = null;
  private completedCache: RoadmapCacheEntry | null = null;
  private activeFetchPromise: Promise<RoadmapBoardResponse> | null = null;
  private completedFetchPromise: Promise<RoadmapBoardResponse> | null = null;

  public async getBoard(team?: string, includeCompleted = false): Promise<RoadmapBoardResponse> {
    const active = await this.getCachedActive();

    if (!includeCompleted) {
      return team ? this.filterByTeam(active, team) : active;
    }

    const completed = await this.getCachedCompleted();
    const merged: RoadmapBoardResponse = {
      columns: { ...active.columns, ...completed.columns },
      teams: [...new Set([...active.teams, ...completed.teams])].sort(),
      lastFetchedAt: active.lastFetchedAt,
    };
    return team ? this.filterByTeam(merged, team) : merged;
  }

  public async getIdea(jiraKey: string): Promise<RoadmapIdea | null> {
    if (!this.isValidProjectKey(jiraKey)) return null;
    // Search active first, then completed
    const active = await this.getCachedActive();
    let found = this.findIdea(active, jiraKey);

    if (!found) {
      // Only search completed if it's already cached — don't trigger a Jira fetch just for a single lookup
      if (this.completedCache && Date.now() - this.completedCache.fetchedAt < ROADMAP_CACHE_TTL_MS) {
        found = this.findIdea(this.completedCache.data, jiraKey);
      }
    }

    return found;
  }

  public async getComments(jiraKey: string): Promise<RoadmapComment[]> {
    if (!this.isValidProjectKey(jiraKey)) {
      return [];
    }
    return this.fetchComments(jiraKey);
  }

  /** Only allow keys from the roadmap project to prevent leaking data from other Jira projects. */
  private isValidProjectKey(jiraKey: string): boolean {
    const pattern = new RegExp(`^${JIRA_ROADMAP_PROJECT_KEY}-\\d+$`);
    return pattern.test(jiraKey);
  }

  private filterByTeam(board: RoadmapBoardResponse, team: string): RoadmapBoardResponse {
    const filtered: RoadmapBoardResponse = {
      columns: {},
      teams: board.teams,
      lastFetchedAt: board.lastFetchedAt,
    };
    for (const [column, ideas] of Object.entries(board.columns)) {
      filtered.columns[column] = ideas.filter((idea) => idea.teams.includes(team));
    }
    return filtered;
  }

  private findIdea(board: RoadmapBoardResponse, jiraKey: string): RoadmapIdea | null {
    for (const ideas of Object.values(board.columns)) {
      const found = ideas.find((idea) => idea.jiraKey === jiraKey);
      if (found) return found;
    }
    return null;
  }

  private async getCachedActive(): Promise<RoadmapBoardResponse> {
    if (this.activeCache && Date.now() - this.activeCache.fetchedAt < ROADMAP_CACHE_TTL_MS) {
      return this.activeCache.data;
    }

    if (this.activeFetchPromise) {
      return this.activeFetchPromise;
    }

    const roadmapFieldId = JIRA_ROADMAP_FIELDS.ROADMAP.replace(/\D/g, '');
    const columnValues = ROADMAP_ACTIVE_COLUMNS.map((c) => `"${c}"`).join(', ');
    const jql = `project = ${JIRA_ROADMAP_PROJECT_KEY} AND issuetype = Idea AND cf[${roadmapFieldId}] IN (${columnValues}) ORDER BY rank ASC`;

    this.activeFetchPromise = this.fetchFromJira(jql, [...ROADMAP_ACTIVE_COLUMNS])
      .then((data) => {
        this.activeCache = { data, fetchedAt: Date.now() };
        this.activeFetchPromise = null;
        return data;
      })
      .catch((error) => {
        this.activeFetchPromise = null;
        if (this.activeCache) {
          serverLogger.warn({ err: error }, 'Jira fetch failed, serving stale active roadmap cache');
          return this.activeCache.data;
        }
        throw error;
      });

    return this.activeFetchPromise;
  }

  private async getCachedCompleted(): Promise<RoadmapBoardResponse> {
    if (this.completedCache && Date.now() - this.completedCache.fetchedAt < ROADMAP_CACHE_TTL_MS) {
      return this.completedCache.data;
    }

    if (this.completedFetchPromise) {
      return this.completedFetchPromise;
    }

    const roadmapFieldId = JIRA_ROADMAP_FIELDS.ROADMAP.replace(/\D/g, '');
    const columnValues = ROADMAP_COMPLETED_COLUMNS.map((c) => `"${c}"`).join(', ');
    const jql = `project = ${JIRA_ROADMAP_PROJECT_KEY} AND issuetype = Idea AND cf[${roadmapFieldId}] IN (${columnValues}) ORDER BY rank ASC`;

    this.completedFetchPromise = this.fetchFromJira(jql, [...ROADMAP_COMPLETED_COLUMNS])
      .then((data) => {
        this.completedCache = { data, fetchedAt: Date.now() };
        this.completedFetchPromise = null;
        return data;
      })
      .catch((error) => {
        this.completedFetchPromise = null;
        if (this.completedCache) {
          serverLogger.warn({ err: error }, 'Jira fetch failed, serving stale completed roadmap cache');
          return this.completedCache.data;
        }
        throw error;
      });

    return this.completedFetchPromise;
  }

  private async fetchFromJira(jql: string, columns: string[]): Promise<RoadmapBoardResponse> {
    const cloudId = process.env['ATLASSIAN_CLOUD_ID'];
    const email = process.env['ATLASSIAN_EMAIL'];
    const apiKey = process.env['ATLASSIAN_API_KEY'];

    if (!cloudId || !email || !apiKey) {
      throw new Error('Missing ATLASSIAN_CLOUD_ID, ATLASSIAN_EMAIL, or ATLASSIAN_API_KEY environment variables');
    }

    const baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}`;
    const auth = `Basic ${Buffer.from(`${email}:${apiKey}`).toString('base64')}`;

    const allIssues: JiraIssue[] = [];
    let nextPageToken: string | undefined;
    let isLast = false;

    serverLogger.info({ jql }, 'Fetching roadmap ideas from Jira');

    while (!isLast) {
      const params = new URLSearchParams({
        jql,
        maxResults: '100',
        fields: JIRA_ROADMAP_FETCH_FIELDS,
      });
      if (nextPageToken) {
        params.set('nextPageToken', nextPageToken);
      }

      const url = `${baseUrl}/rest/api/3/search/jql?${params.toString()}`;
      const res = await fetch(url, {
        headers: { Authorization: auth, Accept: 'application/json' },
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Jira API error ${res.status}: ${body.slice(0, 300)}`);
      }

      const data = (await res.json()) as JiraSearchResponse;
      allIssues.push(...(data.issues ?? []));
      nextPageToken = data.nextPageToken;
      isLast = data.isLast ?? !data.nextPageToken;
    }

    serverLogger.info({ count: allIssues.length }, 'Fetched roadmap ideas from Jira');

    const columnMap: Record<string, RoadmapIdea[]> = {};
    for (const col of columns) {
      columnMap[col] = [];
    }

    const teamsSet = new Set<string>();

    for (const issue of allIssues) {
      const idea = this.mapJiraIssue(issue);
      if (!idea.roadmapColumn || !columnMap[idea.roadmapColumn]) {
        continue;
      }
      columnMap[idea.roadmapColumn].push(idea);
      for (const team of idea.teams) {
        teamsSet.add(team);
      }
    }

    return {
      columns: columnMap,
      teams: [...teamsSet].sort(),
      lastFetchedAt: new Date().toISOString(),
    };
  }

  private mapJiraIssue(issue: JiraIssue): RoadmapIdea {
    const f = issue.fields;
    return {
      jiraKey: issue.key,
      summary: f.summary ?? '',
      descriptionAdf: f.description ?? null,
      roadmapColumn: f[JIRA_ROADMAP_FIELDS.ROADMAP]?.value ?? '',
      teams: (f[JIRA_ROADMAP_FIELDS.TEAMS] ?? []).map((t: JiraOption) => t.value),
      goals: (f[JIRA_ROADMAP_FIELDS.GOALS] ?? []).map((g: JiraOption) => g.value),
      category: f[JIRA_ROADMAP_FIELDS.CATEGORY]?.value ?? null,
      value: f[JIRA_ROADMAP_FIELDS.VALUE] ?? null,
      effort: f[JIRA_ROADMAP_FIELDS.EFFORT] ?? null,
      impact: f[JIRA_ROADMAP_FIELDS.IMPACT] ?? null,
      status: f.status?.name ?? '',
      votes: f.votes?.votes ?? 0,
      jiraUrl: `${JIRA_SITE_URL}/browse/${issue.key}`,
      reporter: this.mapJiraUser(f.reporter),
      creator: this.mapJiraUser(f.creator),
      assignee: this.mapJiraUser(f.assignee),
      createdAt: f.created ?? '',
      updatedAt: f.updated ?? '',
    };
  }

  /** Redact full name to "First L." for privacy. */
  private redactName(displayName: string): string {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length < 2) return parts[0] ?? '';
    const first = parts[0];
    const lastInitial = parts[parts.length - 1][0];
    return `${first} ${lastInitial}.`;
  }

  private mapJiraUser(user: JiraUser | null | undefined): RoadmapPerson | null {
    if (!user?.displayName) return null;
    return {
      name: this.redactName(user.displayName),
      avatarUrl: user.avatarUrls?.['48x48'] ?? user.avatarUrls?.['32x32'] ?? null,
    };
  }

  private async fetchComments(jiraKey: string): Promise<RoadmapComment[]> {
    const cloudId = process.env['ATLASSIAN_CLOUD_ID'];
    const email = process.env['ATLASSIAN_EMAIL'];
    const apiKey = process.env['ATLASSIAN_API_KEY'];

    if (!cloudId || !email || !apiKey) return [];

    try {
      const baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}`;
      const auth = `Basic ${Buffer.from(`${email}:${apiKey}`).toString('base64')}`;
      const url = `${baseUrl}/rest/api/3/issue/${encodeURIComponent(jiraKey)}/comment?orderBy=-created&maxResults=50`;

      const res = await fetch(url, {
        headers: { Authorization: auth, Accept: 'application/json' },
      });

      if (!res.ok) return [];

      const data = (await res.json()) as JiraCommentsResponse;
      return (data.comments ?? []).map((c: JiraComment) => ({
        author: this.mapJiraUser(c.author),
        bodyAdf: c.body ?? null,
        createdAt: c.created ?? '',
      }));
    } catch (error) {
      serverLogger.warn({ err: error, jiraKey }, 'Failed to fetch comments for roadmap idea');
      return [];
    }
  }
}

export const roadmapService = new RoadmapService();
