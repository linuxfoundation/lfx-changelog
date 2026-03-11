// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import { SearchQueryParamsSchema, SearchResponseSchema } from '@lfx-changelog/shared';

export const searchRegistry = new OpenAPIRegistry();

searchRegistry.registerPath({
  method: 'get',
  path: '/public/api/search',
  tags: ['Public - Search'],
  summary: 'Search published content',
  description:
    'Full-text search across published changelogs or blog posts with fuzzy matching, relevance scoring, highlighted snippets, and facets.\n\n' +
    'Use the `target` query parameter to select which index to search (`changelogs` or `blogs`).\n\n' +
    '**Required privilege:** None — this endpoint is publicly accessible.',
  request: {
    query: SearchQueryParamsSchema,
  },
  responses: {
    200: {
      description: 'Search results with highlights and facets',
      content: {
        'application/json': {
          schema: SearchResponseSchema,
        },
      },
    },
    503: {
      description: 'Search is currently unavailable (OpenSearch not connected)',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            error: z.string(),
          }),
        },
      },
    },
  },
});

searchRegistry.registerPath({
  method: 'post',
  path: '/api/opensearch/reindex',
  tags: ['OpenSearch'],
  summary: 'Reindex OpenSearch indices',
  description:
    'Deletes and re-indexes the specified OpenSearch indices from the database. ' +
    'Use the `target` query parameter to control which indices are rebuilt.\n\n' +
    '**Required privilege:** `super_admin`',
  security: [{ apiKeyAuth: [] }],
  request: {
    query: z.object({
      target: z.enum(['changelogs', 'blogs', 'all']).default('all').openapi({ description: 'Which index to reindex (default: all)' }),
    }),
  },
  responses: {
    200: {
      description: 'Reindex result per target',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.record(
              z.string(),
              z.object({
                indexed: z.number().openapi({ description: 'Number of entries indexed' }),
                errors: z.number().openapi({ description: 'Number of indexing errors' }),
              })
            ),
          }),
        },
      },
    },
    503: {
      description: 'OpenSearch is not configured',
    },
  },
});
