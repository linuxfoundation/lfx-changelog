// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import { RepositoryWithCountsSchema, StoredReleaseSchema, createApiResponseSchema } from '@lfx-changelog/shared';

import { API_KEY_AUTH } from '../constants';

export const releaseRegistry = new OpenAPIRegistry();

releaseRegistry.registerPath({
  method: 'get',
  path: '/api/releases',
  tags: ['Releases'],
  summary: 'List latest releases',
  description: 'Returns the latest non-draft releases from all linked GitHub repositories, sorted by publish date.',
  security: API_KEY_AUTH,
  request: {
    query: z.object({
      limit: z.string().optional().openapi({ description: 'Maximum results to return (default 20, max 100)' }),
      productId: z.string().optional().openapi({ description: 'Filter releases by product ID' }),
    }),
  },
  responses: {
    200: {
      description: 'List of stored releases',
      content: {
        'application/json': {
          schema: createApiResponseSchema(z.array(StoredReleaseSchema)),
        },
      },
    },
    401: { description: 'Unauthorized' },
  },
});

releaseRegistry.registerPath({
  method: 'post',
  path: '/api/releases/sync/{productId}',
  tags: ['Releases'],
  summary: 'Sync releases for a product',
  description:
    'Fetches releases from GitHub for all linked repositories of a product and persists them in the database.\n\n**Required privilege:** SUPER_ADMIN role.',
  security: API_KEY_AUTH,
  request: {
    params: z.object({
      productId: z.string().openapi({ description: 'Product ID to sync releases for' }),
    }),
  },
  responses: {
    200: {
      description: 'Sync result',
      content: {
        'application/json': {
          schema: createApiResponseSchema(z.object({ synced: z.number() })),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires SUPER_ADMIN role' },
  },
});

releaseRegistry.registerPath({
  method: 'get',
  path: '/api/releases/repositories',
  tags: ['Releases'],
  summary: 'List all repositories with release counts',
  description: 'Returns all linked GitHub repositories with their release counts and last sync timestamps.\n\n**Required privilege:** SUPER_ADMIN role.',
  security: API_KEY_AUTH,
  responses: {
    200: {
      description: 'List of repositories with counts',
      content: {
        'application/json': {
          schema: createApiResponseSchema(z.array(RepositoryWithCountsSchema)),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires SUPER_ADMIN role' },
  },
});

releaseRegistry.registerPath({
  method: 'post',
  path: '/api/releases/sync/repo/{repoId}',
  tags: ['Releases'],
  summary: 'Sync releases for a single repository',
  description: 'Fetches releases from GitHub for a single repository and persists them in the database.\n\n**Required privilege:** SUPER_ADMIN role.',
  security: API_KEY_AUTH,
  request: {
    params: z.object({
      repoId: z.string().openapi({ description: 'Repository ID to sync releases for' }),
    }),
  },
  responses: {
    200: {
      description: 'Sync result',
      content: {
        'application/json': {
          schema: createApiResponseSchema(z.object({ synced: z.number() })),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires SUPER_ADMIN role' },
    404: { description: 'Repository not found' },
  },
});
