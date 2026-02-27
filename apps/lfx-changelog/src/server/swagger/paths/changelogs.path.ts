// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import {
  ChangelogEntrySchema,
  CreateChangelogEntryRequestSchema,
  UpdateChangelogEntryRequestSchema,
  createApiResponseSchema,
  createPaginatedResponseSchema,
} from '@lfx-changelog/shared';

import { COOKIE_AUTH } from '../constants';

export const changelogRegistry = new OpenAPIRegistry();

changelogRegistry.registerPath({
  method: 'get',
  path: '/api/changelogs',
  tags: ['Changelogs'],
  summary: 'List all changelog entries',
  description: 'Returns all changelog entries with optional filters.\n\n**Required privilege:** EDITOR role or above for the target product.',
  security: COOKIE_AUTH,
  request: {
    query: z.object({
      productId: z.string().optional().openapi({ description: 'Filter by product ID' }),
      status: z.string().optional().openapi({ description: 'Filter by status (draft/published)' }),
    }),
  },
  responses: {
    200: {
      description: 'Paginated list of changelog entries',
      content: {
        'application/json': {
          schema: createPaginatedResponseSchema(ChangelogEntrySchema),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires EDITOR role or above' },
  },
});

changelogRegistry.registerPath({
  method: 'get',
  path: '/api/changelogs/{id}',
  tags: ['Changelogs'],
  summary: 'Get changelog entry by ID',
  description: 'Returns a single changelog entry.\n\n**Required privilege:** EDITOR role or above for the target product.',
  security: COOKIE_AUTH,
  request: {
    params: z.object({
      id: z.string().openapi({ description: 'Changelog entry ID' }),
    }),
  },
  responses: {
    200: {
      description: 'Single changelog entry',
      content: {
        'application/json': {
          schema: createApiResponseSchema(ChangelogEntrySchema),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires EDITOR role or above' },
    404: { description: 'Changelog entry not found' },
  },
});

changelogRegistry.registerPath({
  method: 'post',
  path: '/api/changelogs',
  tags: ['Changelogs'],
  summary: 'Create changelog entry',
  description: 'Creates a new changelog entry.\n\n**Required privilege:** EDITOR role or above for the target product.',
  security: COOKIE_AUTH,
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateChangelogEntryRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Changelog entry created',
      content: {
        'application/json': {
          schema: createApiResponseSchema(ChangelogEntrySchema),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires EDITOR role or above' },
  },
});

changelogRegistry.registerPath({
  method: 'put',
  path: '/api/changelogs/{id}',
  tags: ['Changelogs'],
  summary: 'Update changelog entry',
  description: 'Updates an existing changelog entry.\n\n**Required privilege:** EDITOR role or above for the target product.',
  security: COOKIE_AUTH,
  request: {
    params: z.object({
      id: z.string().openapi({ description: 'Changelog entry ID' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateChangelogEntryRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Changelog entry updated',
      content: {
        'application/json': {
          schema: createApiResponseSchema(ChangelogEntrySchema),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires EDITOR role or above' },
    404: { description: 'Changelog entry not found' },
  },
});

changelogRegistry.registerPath({
  method: 'patch',
  path: '/api/changelogs/{id}/publish',
  tags: ['Changelogs'],
  summary: 'Publish changelog entry',
  description: 'Publishes a draft changelog entry.\n\n**Required privilege:** EDITOR role or above for the target product.',
  security: COOKIE_AUTH,
  request: {
    params: z.object({
      id: z.string().openapi({ description: 'Changelog entry ID' }),
    }),
  },
  responses: {
    200: {
      description: 'Changelog entry published',
      content: {
        'application/json': {
          schema: createApiResponseSchema(ChangelogEntrySchema),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires EDITOR role or above' },
    404: { description: 'Changelog entry not found' },
  },
});

changelogRegistry.registerPath({
  method: 'delete',
  path: '/api/changelogs/{id}',
  tags: ['Changelogs'],
  summary: 'Delete changelog entry',
  description: 'Deletes a changelog entry.\n\n**Required privilege:** PRODUCT_ADMIN role or above for the target product.',
  security: COOKIE_AUTH,
  request: {
    params: z.object({
      id: z.string().openapi({ description: 'Changelog entry ID' }),
    }),
  },
  responses: {
    204: { description: 'Changelog entry deleted' },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires PRODUCT_ADMIN role or above' },
    404: { description: 'Changelog entry not found' },
  },
});
