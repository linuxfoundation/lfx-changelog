// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

/** Jira custom field IDs for the LFX Product Roadmap JPD project. */
export const JIRA_ROADMAP_FIELDS = {
  ROADMAP: 'customfield_10141',
  TEAMS: 'customfield_10145',
  GOALS: 'customfield_10140',
  CATEGORY: 'customfield_10152',
  VALUE: 'customfield_10153',
  EFFORT: 'customfield_10154',
  IMPACT: 'customfield_10134',
} as const;

export const JIRA_ROADMAP_PROJECT_KEY = 'LFX';
export const JIRA_SITE_URL = 'https://linuxfoundation.atlassian.net';
export const ROADMAP_CACHE_TTL_MS = 5 * 60 * 1_000; // 5 minutes

export const ROADMAP_COLUMNS = ['Now', 'Next', 'Later', 'Done', "Won't do"] as const;
export const ROADMAP_ACTIVE_COLUMNS = ['Now', 'Next', 'Later'] as const;
export const ROADMAP_COMPLETED_COLUMNS = ['Done', "Won't do"] as const;

export const ROADMAP_COLUMN_ORDER: Record<string, number> = {
  Now: 0,
  Next: 1,
  Later: 2,
  Done: 3,
  "Won't do": 4,
};

/** Display name overrides for Jira team values. */
export const ROADMAP_TEAM_DISPLAY_NAMES: Record<string, string> = {
  PCC: 'Project Control Center',
};

/** Standard + custom Jira fields to request from the search/jql API. */
export const JIRA_ROADMAP_FETCH_FIELDS = [
  'summary',
  'status',
  'description',
  'votes',
  'created',
  'updated',
  'reporter',
  'creator',
  'assignee',
  JIRA_ROADMAP_FIELDS.ROADMAP,
  JIRA_ROADMAP_FIELDS.TEAMS,
  JIRA_ROADMAP_FIELDS.GOALS,
  JIRA_ROADMAP_FIELDS.CATEGORY,
  JIRA_ROADMAP_FIELDS.VALUE,
  JIRA_ROADMAP_FIELDS.EFFORT,
  JIRA_ROADMAP_FIELDS.IMPACT,
].join(',');
