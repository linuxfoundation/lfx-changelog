// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { z } from 'zod';

import { JIRA_ROADMAP_FIELDS as JIRA_ROADMAP_FIELD_IDS, ROADMAP_COLUMNS } from '../constants/roadmap.constant.js';

export const RoadmapColumnSchema = z.enum(ROADMAP_COLUMNS).openapi('RoadmapColumn');

export type RoadmapColumn = z.infer<typeof RoadmapColumnSchema>;

export const RoadmapPersonSchema = z
  .object({
    name: z.string(),
    avatarUrl: z.string().nullable(),
  })
  .openapi('RoadmapPerson');

export type RoadmapPerson = z.infer<typeof RoadmapPersonSchema>;

export const RoadmapIdeaSchema = z
  .object({
    jiraKey: z.string(),
    summary: z.string(),
    descriptionAdf: z.record(z.string(), z.unknown()).nullable(),
    roadmapColumn: z.string(),
    teams: z.array(z.string()),
    goals: z.array(z.string()),
    category: z.string().nullable(),
    value: z.number().nullable(),
    effort: z.number().nullable(),
    impact: z.number().nullable(),
    status: z.string(),
    votes: z.number(),
    jiraUrl: z.string(),
    reporter: RoadmapPersonSchema.nullable(),
    creator: RoadmapPersonSchema.nullable(),
    assignee: RoadmapPersonSchema.nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('RoadmapIdea');

export type RoadmapIdea = z.infer<typeof RoadmapIdeaSchema>;

export const RoadmapCommentSchema = z
  .object({
    author: RoadmapPersonSchema.nullable(),
    bodyAdf: z.record(z.string(), z.unknown()).nullable(),
    createdAt: z.string(),
  })
  .openapi('RoadmapComment');

export type RoadmapComment = z.infer<typeof RoadmapCommentSchema>;

export const RoadmapIdeaDetailSchema = RoadmapIdeaSchema.extend({
  comments: z.array(RoadmapCommentSchema),
}).openapi('RoadmapIdeaDetail');

export type RoadmapIdeaDetail = z.infer<typeof RoadmapIdeaDetailSchema>;

export const RoadmapBoardResponseSchema = z
  .object({
    columns: z.record(z.string(), z.array(RoadmapIdeaSchema)),
    teams: z.array(z.string()),
    lastFetchedAt: z.string(),
  })
  .openapi('RoadmapBoardResponse');

export type RoadmapBoardResponse = z.infer<typeof RoadmapBoardResponseSchema>;

export const RoadmapQueryParamsSchema = z.object({
  team: z.string().optional(),
});

export type RoadmapQueryParams = z.infer<typeof RoadmapQueryParamsSchema>;

// ── ADF (Atlassian Document Format) types ──────────────────────────────

export type AdfMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

export type AdfNode = {
  type: string;
  text?: string;
  content?: AdfNode[];
  marks?: AdfMark[];
  attrs?: Record<string, unknown>;
};

// ── Cache types ────────────────────────────────────────────────────────

export type RoadmapCacheEntry = {
  data: RoadmapBoardResponse;
  fetchedAt: number;
};

// ── Jira API types (used by the roadmap sync service) ──────────────────

export type JiraOption = { value: string; id: string };

export type JiraUser = {
  displayName?: string;
  avatarUrls?: Record<string, string>;
  emailAddress?: string;
};

export type JiraIssueFields = {
  summary?: string;
  status?: { name: string };
  description?: Record<string, unknown> | null;
  votes?: { votes: number };
  reporter?: JiraUser | null;
  creator?: JiraUser | null;
  assignee?: JiraUser | null;
  created?: string;
  updated?: string;
  /** Roadmap column (single select) — customfield_10141 */
  [JIRA_ROADMAP_FIELD_IDS.ROADMAP]?: JiraOption | null;
  /** Teams (multi-select) — customfield_10145 */
  [JIRA_ROADMAP_FIELD_IDS.TEAMS]?: JiraOption[];
  /** Goals (multi-select) — customfield_10140 */
  [JIRA_ROADMAP_FIELD_IDS.GOALS]?: JiraOption[];
  /** Category (single select) — customfield_10152 */
  [JIRA_ROADMAP_FIELD_IDS.CATEGORY]?: JiraOption | null;
  /** Value score — customfield_10153 */
  [JIRA_ROADMAP_FIELD_IDS.VALUE]?: number | null;
  /** Effort score — customfield_10154 */
  [JIRA_ROADMAP_FIELD_IDS.EFFORT]?: number | null;
  /** Impact score — customfield_10134 */
  [JIRA_ROADMAP_FIELD_IDS.IMPACT]?: number | null;
};

export type JiraIssue = {
  key: string;
  fields: JiraIssueFields;
};

export type JiraSearchResponse = {
  issues?: JiraIssue[];
  nextPageToken?: string;
  isLast?: boolean;
};

export type JiraComment = {
  author?: JiraUser;
  body?: Record<string, unknown> | null;
  created?: string;
};

export type JiraCommentsResponse = {
  comments?: JiraComment[];
  total?: number;
};
