// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import {
  CreateReleaseRequestSchema,
  GenerateReleaseNotesRequestSchema,
  GeneratedReleaseNotesSchema,
  GitHubReleaseSchema,
  ReleaseChangesQuerySchema,
  ReleaseChangesSchema,
  ReleaseTargetSchema,
  RepositoryWithCountsSchema,
  StoredReleaseSchema,
  createApiResponseSchema,
} from '@lfx-changelog/shared';

import { COOKIE_AUTH } from '../constants';

export const releaseRegistry = new OpenAPIRegistry();

const repoIdParam = z.object({ repoId: z.string().uuid().openapi({ description: 'Tracked repository ID' }) });

releaseRegistry.registerPath({
  method: 'get',
  path: '/api/github/releases',
  tags: ['Releases'],
  summary: 'List latest releases',
  description: 'Returns the latest non-draft releases from all linked GitHub repositories, sorted by publish date.',
  security: COOKIE_AUTH,
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
  path: '/api/github/products/{productId}/sync',
  tags: ['Releases'],
  summary: 'Sync releases for a product',
  description:
    'Fetches releases from GitHub for all linked repositories of a product and persists them in the database.\n\n**Required privilege:** SUPER_ADMIN role.',
  security: COOKIE_AUTH,
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
  path: '/api/github/repositories',
  tags: ['Releases'],
  summary: 'List all repositories with release counts',
  description: 'Returns all linked GitHub repositories with their release counts and last sync timestamps.\n\n**Required privilege:** SUPER_ADMIN role.',
  security: COOKIE_AUTH,
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
  path: '/api/github/repositories/{repoId}/sync',
  tags: ['Releases'],
  summary: 'Sync releases for a single repository',
  description:
    'Fetches releases from GitHub for a single repository and persists them in the database.\n\n**Required privilege:** PRODUCT_ADMIN on the product that owns the repository. A repository the caller does not administer reports 404 rather than 403.',
  security: COOKIE_AUTH,
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
    403: { description: 'Forbidden — requires PRODUCT_ADMIN or higher' },
    404: { description: 'Repository not found, or the caller is not a PRODUCT_ADMIN for the product that owns it' },
  },
});

releaseRegistry.registerPath({
  method: 'get',
  path: '/api/github/repositories/{repoId}/release-target',
  tags: ['Releases'],
  summary: 'Get release target details for a repository',
  description:
    "Returns the repository's default branch, its branches, the newest stored tag and a suggested next tag, for prefilling the create-release form.\n\n**Required privilege:** PRODUCT_ADMIN on the product that owns the repository. Session authentication only.",
  security: COOKIE_AUTH,
  request: { params: repoIdParam },
  responses: {
    200: {
      description: 'Release target',
      content: { 'application/json': { schema: createApiResponseSchema(ReleaseTargetSchema) } },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — API key used on a session-only endpoint, or GitHub denied the App access' },
    404: { description: 'Repository not found, or the caller is not a PRODUCT_ADMIN for the product that owns it' },
    503: { description: 'GitHub rate limit reached' },
    502: { description: 'GitHub was unavailable' },
  },
});

releaseRegistry.registerPath({
  method: 'get',
  path: '/api/github/repositories/{repoId}/changes',
  tags: ['Releases'],
  summary: 'Count changes since the last release',
  description:
    'Compares the newest stored release for the repository against the given target and reports how much has landed since, for the create-release form to show before publishing.\n\nWith no previous release every count is null.\n\n**Required privilege:** PRODUCT_ADMIN on the product that owns the repository.',
  security: COOKIE_AUTH,
  request: { params: repoIdParam, query: ReleaseChangesQuerySchema },
  responses: {
    200: {
      description: 'Change summary',
      content: { 'application/json': { schema: createApiResponseSchema(ReleaseChangesSchema) } },
    },
    400: { description: 'Validation failed' },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — API key used on a session-only endpoint, or GitHub denied the App access' },
    404: { description: 'Repository not found, or the caller is not a PRODUCT_ADMIN for the product that owns it' },
    503: { description: 'GitHub rate limit reached' },
    502: { description: 'GitHub was unavailable' },
  },
});

releaseRegistry.registerPath({
  method: 'post',
  path: '/api/github/repositories/{repoId}/release-notes',
  tags: ['Releases'],
  summary: 'Preview generated release notes',
  description:
    'Asks GitHub to generate release notes from pull requests merged since the previous tag, so the form can prefill them for editing. Nothing is created.\n\n**Required privilege:** PRODUCT_ADMIN on the product that owns the repository.',
  security: COOKIE_AUTH,
  request: { params: repoIdParam, body: { content: { 'application/json': { schema: GenerateReleaseNotesRequestSchema } } } },
  responses: {
    200: {
      description: 'Generated notes',
      content: { 'application/json': { schema: createApiResponseSchema(GeneratedReleaseNotesSchema) } },
    },
    400: { description: 'Validation failed' },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — API key used on a session-only endpoint, or GitHub denied the App access' },
    404: { description: 'Repository not found, or the caller is not a PRODUCT_ADMIN for the product that owns it' },
    422: { description: 'GitHub rejected the request, most commonly an unknown target branch or commit' },
    503: { description: 'GitHub rate limit reached' },
    502: { description: 'GitHub was unavailable' },
  },
});

releaseRegistry.registerPath({
  method: 'post',
  path: '/api/github/repositories/{repoId}/releases',
  tags: ['Releases'],
  summary: 'Publish a GitHub release',
  description:
    'Creates a published release on GitHub, which also creates the tag at `targetCommitish`. The release is stored by the existing `release.published` webhook rather than written here, so a release created this way is indistinguishable from one created on GitHub directly.\n\nRequires the GitHub App to hold **Contents: write**.\n\n**Required privilege:** PRODUCT_ADMIN on the product that owns the repository. Session authentication only.',
  security: COOKIE_AUTH,
  request: { params: repoIdParam, body: { content: { 'application/json': { schema: CreateReleaseRequestSchema } } } },
  responses: {
    201: {
      description: 'Release created',
      content: { 'application/json': { schema: createApiResponseSchema(GitHubReleaseSchema) } },
    },
    400: { description: 'Validation failed' },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — API key used on a session-only endpoint, or the GitHub App lacks Contents: write' },
    404: { description: 'Repository not found, or the caller is not a PRODUCT_ADMIN for the product that owns it' },
    409: { description: 'The tag already exists on the repository' },
    422: { description: 'GitHub rejected the release, most commonly an unknown target branch or commit' },
    503: { description: 'GitHub rate limit reached' },
    502: { description: 'GitHub was unavailable' },
  },
});
