// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import { SearchQueryParamsSchema, SearchResponseSchema } from '@lfx-changelog/shared';

export const searchRegistry = new OpenAPIRegistry();

searchRegistry.registerPath({
  method: 'get',
  path: '/public/api/changelogs/search',
  tags: ['Public - Search'],
  summary: 'Search published changelogs',
  description:
    'Full-text search across published changelog entries with fuzzy matching, relevance scoring, highlighted snippets, and product facets.\n\n' +
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
  summary: 'Reindex all published changelogs',
  description:
    'Deletes the existing OpenSearch index and re-indexes all published changelog entries from the database.\n\n' + '**Required privilege:** `super_admin`',
  security: [{ apiKeyAuth: [] }],
  responses: {
    200: {
      description: 'Reindex result',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              indexed: z.number().openapi({ description: 'Number of entries indexed' }),
              errors: z.number().openapi({ description: 'Number of indexing errors' }),
            }),
          }),
        },
      },
    },
    503: {
      description: 'OpenSearch is not configured',
    },
  },
});
