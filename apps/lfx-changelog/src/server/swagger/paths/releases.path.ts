// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import {
  CreateReleaseRequestSchema,
  GenerateReleaseNotesRequestSchema,
  GeneratedReleaseNotesSchema,
  GitHubReleaseSchema,
  ReleaseTargetSchema,
  RepositoryWithCountsSchema,
  StoredReleaseSchema,
  createApiResponseSchema,
} from '@lfx-changelog/shared';

import { API_KEY_AUTH, COOKIE_AUTH } from '../constants';

export const releaseRegistry = new OpenAPIRegistry();

const repoIdParam = z.object({ repoId: z.string().uuid().openapi({ description: 'Tracked repository ID' }) });

releaseRegistry.registerPath({
  method: 'get',
  path: '/api/releases',
  tags: ['Releases'],
  summary: 'List latest releases',
  description: 'Returns the latest non-draft releases from all linked GitHub repositories, sorted by publish date.',
  security: API_KEY_AUTH,
  request: {
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).optional().openapi({ description: 'Maximum results to return (default 20, max 100)' }),
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

releaseRegistry.registerPath({
  method: 'get',
  path: '/api/releases/repositories/{repoId}/target',
  tags: ['Releases'],
  summary: 'Get release target details for a repository',
  description:
    "Returns the repository's default branch, its branches, the newest stored tag and a suggested next tag, for prefilling the create-release form.\n\n**Required privilege:** PRODUCT_ADMIN on the product that owns the repository. Session authentication only.",
  security: COOKIE_AUTH,
  request: { params: repoIdParam },
  responses: {
    200: { description: 'Release target', content: { 'application/json': { schema: createApiResponseSchema(ReleaseTargetSchema) } } },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires PRODUCT_ADMIN' },
    404: { description: 'Repository not found, or not one the caller administers' },
  },
});

releaseRegistry.registerPath({
  method: 'post',
  path: '/api/releases/repositories/{repoId}/notes',
  tags: ['Releases'],
  summary: 'Preview generated release notes',
  description:
    'Asks GitHub to generate release notes from pull requests merged since the previous tag, so the form can prefill them for editing. Nothing is created.\n\n**Required privilege:** PRODUCT_ADMIN on the product that owns the repository.',
  security: COOKIE_AUTH,
  request: { params: repoIdParam, body: { content: { 'application/json': { schema: GenerateReleaseNotesRequestSchema } } } },
  responses: {
    200: { description: 'Generated notes', content: { 'application/json': { schema: createApiResponseSchema(GeneratedReleaseNotesSchema) } } },
    400: { description: 'Validation failed' },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires PRODUCT_ADMIN, or the GitHub App lacks access' },
    404: { description: 'Repository not found, or not one the caller administers' },
  },
});

releaseRegistry.registerPath({
  method: 'post',
  path: '/api/releases/repositories/{repoId}',
  tags: ['Releases'],
  summary: 'Publish a GitHub release',
  description:
    'Creates a published release on GitHub, which also creates the tag at `targetCommitish`. The release is stored by the existing `release.published` webhook rather than written here, so a release created this way is indistinguishable from one created on GitHub directly.\n\nRequires the GitHub App to hold **Contents: write**.\n\n**Required privilege:** PRODUCT_ADMIN on the product that owns the repository. Session authentication only.',
  security: COOKIE_AUTH,
  request: { params: repoIdParam, body: { content: { 'application/json': { schema: CreateReleaseRequestSchema } } } },
  responses: {
    201: { description: 'Release created', content: { 'application/json': { schema: createApiResponseSchema(GitHubReleaseSchema) } } },
    400: { description: 'Validation failed' },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires PRODUCT_ADMIN, or the GitHub App lacks Contents: write' },
    404: { description: 'Repository not found, or not one the caller administers' },
    409: { description: 'GitHub rejected the release, most commonly because the tag already exists' },
    502: { description: 'GitHub was unavailable' },
  },
});
