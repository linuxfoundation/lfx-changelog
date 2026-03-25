// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import { PublicChangelogEntrySchema, createApiResponseSchema, createPaginatedResponseSchema } from '@lfx-changelog/shared';

export const publicChangelogRegistry = new OpenAPIRegistry();

publicChangelogRegistry.registerPath({
  method: 'get',
  path: '/public/api/changelogs',
  tags: ['Public - Changelogs'],
  summary: 'List published changelogs',
  description: 'Returns published changelog entries with pagination.\n\n**Required privilege:** None — this endpoint is publicly accessible.',
  request: {
    query: z.object({
      page: z.coerce.number().optional().openapi({ description: 'Page number (default: 1)' }),
      limit: z.coerce.number().optional().openapi({ description: 'Items per page (default: 10)' }),
      productId: z.string().optional().openapi({ description: 'Filter by product ID' }),
      productSlug: z.string().optional().openapi({ description: 'Filter by product slug (e.g., "insights", "easycla")' }),
    }),
  },
  responses: {
    200: {
      description: 'Paginated list of published changelogs',
      content: {
        'application/json': {
          schema: createPaginatedResponseSchema(PublicChangelogEntrySchema),
        },
      },
    },
  },
});

publicChangelogRegistry.registerPath({
  method: 'get',
  path: '/public/api/changelogs/{id}',
  tags: ['Public - Changelogs'],
  summary: 'Get published changelog by ID or slug',
  description:
    'Returns a single published changelog entry. Accepts either a UUID or a URL-friendly slug.\n\n**Required privilege:** None — this endpoint is publicly accessible.',
  request: {
    params: z.object({
      id: z.string().openapi({ description: 'Changelog entry ID (UUID) or slug' }),
    }),
  },
  responses: {
    200: {
      description: 'Single published changelog entry',
      content: {
        'application/json': {
          schema: createApiResponseSchema(PublicChangelogEntrySchema),
        },
      },
    },
    404: {
      description: 'Changelog entry not found',
    },
  },
});
