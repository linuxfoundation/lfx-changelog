// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import {
  ChangelogEntrySchema,
  ChangelogEntryWithRelationsSchema,
  CreateChangelogEntryRequestSchema,
  MarkViewedRequestSchema,
  MarkViewedResponseSchema,
  UnseenCountSchema,
  UpdateChangelogEntryRequestSchema,
  createApiResponseSchema,
  createPaginatedResponseSchema,
} from '@lfx-changelog/shared';

import { API_KEY_AUTH } from '../constants';

export const changelogRegistry = new OpenAPIRegistry();

changelogRegistry.registerPath({
  method: 'get',
  path: '/api/changelogs',
  tags: ['Changelogs'],
  summary: 'List all changelog entries',
  description: 'Returns all changelog entries with optional filters.\n\n**Required privilege:** EDITOR role or above for the target product.',
  security: API_KEY_AUTH,
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
  security: API_KEY_AUTH,
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
  security: API_KEY_AUTH,
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
  security: API_KEY_AUTH,
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
  security: API_KEY_AUTH,
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
  method: 'patch',
  path: '/api/changelogs/{id}/unpublish',
  tags: ['Changelogs'],
  summary: 'Unpublish changelog entry',
  description:
    'Reverts a published changelog entry to draft and removes it from public view.\n\n**Required privilege:** EDITOR role or above for the target product.',
  security: API_KEY_AUTH,
  request: {
    params: z.object({
      id: z.string().openapi({ description: 'Changelog entry ID' }),
    }),
  },
  responses: {
    200: {
      description: 'Changelog entry unpublished',
      content: {
        'application/json': {
          schema: createApiResponseSchema(ChangelogEntryWithRelationsSchema),
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
  security: API_KEY_AUTH,
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

// ── View tracking ───────────────────────────

changelogRegistry.registerPath({
  method: 'get',
  path: '/api/changelogs/views/unseen',
  tags: ['Changelog Views'],
  summary: 'Get unseen changelog counts',
  description:
    'Returns the number of published changelogs a viewer has not yet seen for the given product(s).\n\n' +
    '- **viewerId** (required) — opaque identifier for the viewer (e.g. Auth0 `sub`)\n' +
    '- **productId** (single) → returns a single object\n' +
    '- **productIds** (comma-separated) → returns an array\n' +
    '- Neither productId/productIds → returns counts for all active products\n\n' +
    'The `lastViewedAt` field is `null` if the viewer has never viewed the product, meaning all published changelogs are unseen.',
  security: API_KEY_AUTH,
  request: {
    query: z.object({
      viewerId: z
        .string()
        .min(1)
        .optional()
        .openapi({ description: 'Opaque viewer identifier (e.g. Auth0 sub claim). Required for API key auth, ignored for OAuth.' }),
      productId: z.string().uuid().optional().openapi({ description: 'Single product ID to check' }),
      productIds: z.string().optional().openapi({ description: 'Comma-separated product IDs for batch check' }),
    }),
  },
  responses: {
    200: {
      description: 'Unseen counts',
      content: {
        'application/json': {
          schema: z.union([createApiResponseSchema(UnseenCountSchema), createApiResponseSchema(z.array(UnseenCountSchema))]),
        },
      },
    },
    400: { description: 'Validation failed — viewerId is required' },
    401: { description: 'Unauthorized' },
  },
});

changelogRegistry.registerPath({
  method: 'post',
  path: '/api/changelogs/views/mark-viewed',
  tags: ['Changelog Views'],
  summary: 'Mark changelogs as viewed',
  description:
    "Updates a viewer's last-viewed timestamp for the given product(s) to the current time.\n\n" +
    '- **viewerId** (required) — opaque viewer identifier (e.g. Auth0 `sub`)\n' +
    '- **productId** (single) → returns a single object\n' +
    '- **productIds** (array) → returns an array\n\n' +
    'At least one of `productId` or `productIds` must be provided.',
  security: API_KEY_AUTH,
  request: {
    body: {
      content: {
        'application/json': {
          schema: MarkViewedRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'View recorded',
      content: {
        'application/json': {
          schema: z.union([createApiResponseSchema(MarkViewedResponseSchema), createApiResponseSchema(z.array(MarkViewedResponseSchema))]),
        },
      },
    },
    400: { description: 'Validation failed' },
    401: { description: 'Unauthorized' },
    404: { description: 'One or more product IDs not found' },
  },
});
