// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { OpenAIFunctionTool } from '@lfx-changelog/shared';

export const CHAT_TOOLS_PUBLIC: OpenAIFunctionTool[] = [
  {
    type: 'function',
    function: {
      name: 'list_products',
      description: 'List all available LFX products with their IDs, names, and slugs. Call this first to discover which products exist.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search',
      description:
        "Search published changelogs or blog posts by keywords. Set target to 'changelogs' for release notes and product updates, or 'blogs' for blog posts, roundups, and announcements. ALWAYS provide a query with relevant keywords extracted from the user's question to get the most relevant results. Returns paginated results ranked by relevance.",
      parameters: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            enum: ['changelogs', 'blogs'],
            description: "Which index to search: 'changelogs' for release notes and product updates, 'blogs' for blog posts and announcements.",
          },
          query: {
            type: 'string',
            description:
              'Search keywords to find relevant results (e.g. "security fix", "new dashboard", "monthly roundup"). Highly recommended — omitting this returns all entries sorted by date which is less efficient.',
          },
          productId: { type: 'string', description: 'Filter by product UUID (changelogs only). Use list_products first to find the ID.' },
          type: { type: 'string', description: 'Filter by blog type (blogs only), e.g. "monthly_roundup", "announcement".' },
          page: { type: 'number', description: 'Page number (default 1)' },
          limit: { type: 'number', description: 'Results per page (default 10, max 100)' },
        },
        required: ['target'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_changelog_detail',
      description:
        'Get the full content of a specific changelog entry by its ID. Use this to get the complete description when the truncated version is not enough.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The changelog entry UUID' },
        },
        required: ['id'],
      },
    },
  },
];

export const CHAT_TOOLS_ADMIN: OpenAIFunctionTool[] = [
  {
    type: 'function',
    function: {
      name: 'list_products',
      description: 'List all LFX products (including inactive) with their IDs, names, and slugs.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search',
      description:
        "Search changelogs (including drafts) or blog posts by keywords. Set target to 'changelogs' for release notes and product updates, or 'blogs' for blog posts, roundups, and announcements. ALWAYS provide a query with relevant keywords extracted from the user's question to get the most relevant results. Returns paginated results ranked by relevance.",
      parameters: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            enum: ['changelogs', 'blogs'],
            description: "Which index to search: 'changelogs' for release notes and product updates, 'blogs' for blog posts and announcements.",
          },
          query: {
            type: 'string',
            description:
              'Search keywords to find relevant results (e.g. "security fix", "new dashboard", "monthly roundup"). Highly recommended — omitting this returns all entries sorted by date which is less efficient.',
          },
          productId: { type: 'string', description: 'Filter by product UUID (changelogs only). Use list_products first to find the ID.' },
          type: { type: 'string', description: 'Filter by blog type (blogs only), e.g. "monthly_roundup", "announcement".' },
          status: { type: 'string', enum: ['draft', 'published'], description: 'Filter changelog by status (default: all)' },
          page: { type: 'number', description: 'Page number (default 1)' },
          limit: { type: 'number', description: 'Results per page (default 10, max 100)' },
        },
        required: ['target'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_changelog_detail',
      description:
        'Get the full content of a specific changelog entry by its ID, including drafts. Use this to get the complete description when the truncated version is not enough.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The changelog entry UUID' },
        },
        required: ['id'],
      },
    },
  },
];
