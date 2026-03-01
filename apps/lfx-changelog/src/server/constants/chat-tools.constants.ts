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
      name: 'search_changelogs',
      description:
        'Search published changelog entries. Can filter by product ID. Returns paginated results with title, version, date, and a truncated description.',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'Filter by product UUID. Use list_products first to find the ID.' },
          page: { type: 'number', description: 'Page number (default 1)' },
          limit: { type: 'number', description: 'Results per page (default 20, max 100)' },
        },
        required: [],
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
      name: 'search_changelogs',
      description:
        'Search changelog entries including drafts. Can filter by product ID and status. Returns paginated results with title, version, date, status, and a truncated description.',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'Filter by product UUID. Use list_products first to find the ID.' },
          status: { type: 'string', enum: ['draft', 'published'], description: 'Filter by status (default: all)' },
          page: { type: 'number', description: 'Page number (default 1)' },
          limit: { type: 'number', description: 'Results per page (default 20, max 100)' },
        },
        required: [],
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
