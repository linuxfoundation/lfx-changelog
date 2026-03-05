// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import { MarkViewedRequestSchema, MarkViewedResponseSchema, UnseenCountSchema, createApiResponseSchema } from '@lfx-changelog/shared';

import { API_KEY_AUTH } from '../constants';

export const changelogViewRegistry = new OpenAPIRegistry();

changelogViewRegistry.registerPath({
  method: 'get',
  path: '/api/changelog-views/unseen',
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
      viewerId: z.string().min(1).openapi({ description: 'Opaque viewer identifier (e.g. Auth0 sub claim)' }),
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

changelogViewRegistry.registerPath({
  method: 'post',
  path: '/api/changelog-views/mark-viewed',
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
