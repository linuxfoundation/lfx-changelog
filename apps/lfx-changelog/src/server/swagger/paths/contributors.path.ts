// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import {
  ContributorQueryParamsSchema,
  ContributorSyncResultSchema,
  ContributorWithRelationsSchema,
  LinkContributorSlackRequestSchema,
  SlackWorkspaceUserSchema,
  SyncContributorsRequestSchema,
  createApiResponseSchema,
  createPaginatedResponseSchema,
} from '@lfx-changelog/shared';

import { COOKIE_AUTH } from '../constants';

export const contributorRegistry = new OpenAPIRegistry();

const contributorIdParam = z.object({ id: z.string().uuid().openapi({ description: 'Contributor ID' }) });

contributorRegistry.registerPath({
  method: 'get',
  path: '/api/contributors',
  tags: ['Contributors'],
  summary: 'List contributors',
  description:
    'Returns GitHub contributors discovered across tracked repositories, with their Slack association if one exists.\n\nBot accounts are excluded unless `includeBots` is set.\n\n**Required privilege:** SUPER_ADMIN role.',
  security: COOKIE_AUTH,
  request: { query: ContributorQueryParamsSchema },
  responses: {
    200: {
      description: 'Paginated list of contributors',
      content: { 'application/json': { schema: createPaginatedResponseSchema(ContributorWithRelationsSchema) } },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires SUPER_ADMIN role' },
  },
});

contributorRegistry.registerPath({
  method: 'get',
  path: '/api/contributors/slack-users',
  tags: ['Contributors'],
  summary: 'List Slack workspace users',
  description:
    'Returns the members of the connected Slack workspace, for use as the picker when linking a contributor manually. Deactivated accounts and bots are omitted.\n\n**Required privilege:** SUPER_ADMIN role.',
  security: COOKIE_AUTH,
  responses: {
    200: {
      description: 'Slack workspace members',
      content: { 'application/json': { schema: createApiResponseSchema(z.array(SlackWorkspaceUserSchema)) } },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires SUPER_ADMIN role' },
    503: { description: 'No active Slack bot installation' },
  },
});

contributorRegistry.registerPath({
  method: 'post',
  path: '/api/contributors/sync',
  tags: ['Contributors'],
  summary: 'Sync contributors from GitHub',
  description:
    'Pulls contributors for one product or one repository, enriches them with commit author emails, and auto-links any whose email matches a Slack workspace member.\n\nExactly one of `productId` or `repositoryId` is required — an unscoped sync would crawl every tracked repository inline in the request.\n\n**Required privilege:** SUPER_ADMIN role.',
  security: COOKIE_AUTH,
  request: { body: { content: { 'application/json': { schema: SyncContributorsRequestSchema } } } },
  responses: {
    200: {
      description: 'Sync counts and any per-repository errors',
      content: { 'application/json': { schema: createApiResponseSchema(ContributorSyncResultSchema) } },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires SUPER_ADMIN role' },
  },
});

contributorRegistry.registerPath({
  method: 'get',
  path: '/api/contributors/{id}',
  tags: ['Contributors'],
  summary: 'Get a contributor',
  description: 'Returns a single contributor with the repositories they have contributed to.\n\n**Required privilege:** SUPER_ADMIN role.',
  security: COOKIE_AUTH,
  request: { params: contributorIdParam },
  responses: {
    200: {
      description: 'Contributor detail',
      content: { 'application/json': { schema: createApiResponseSchema(ContributorWithRelationsSchema) } },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires SUPER_ADMIN role' },
    404: { description: 'Contributor not found' },
  },
});

contributorRegistry.registerPath({
  method: 'put',
  path: '/api/contributors/{id}/slack',
  tags: ['Contributors'],
  summary: 'Link a contributor to a Slack user',
  description:
    'Associates a contributor with a Slack workspace member. The Slack user must exist in the connected workspace and must not already be linked to another contributor.\n\n**Required privilege:** SUPER_ADMIN role.',
  security: COOKIE_AUTH,
  request: {
    params: contributorIdParam,
    body: { content: { 'application/json': { schema: LinkContributorSlackRequestSchema } } },
  },
  responses: {
    200: {
      description: 'Updated contributor',
      content: { 'application/json': { schema: createApiResponseSchema(ContributorWithRelationsSchema) } },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires SUPER_ADMIN role' },
    404: { description: 'Contributor or Slack user not found' },
    409: { description: 'Slack user is already linked to another contributor' },
  },
});

contributorRegistry.registerPath({
  method: 'delete',
  path: '/api/contributors/{id}/slack',
  tags: ['Contributors'],
  summary: 'Unlink a contributor from Slack',
  description: 'Removes the Slack association from a contributor.\n\n**Required privilege:** SUPER_ADMIN role.',
  security: COOKIE_AUTH,
  request: { params: contributorIdParam },
  responses: {
    200: {
      description: 'Updated contributor',
      content: { 'application/json': { schema: createApiResponseSchema(ContributorWithRelationsSchema) } },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires SUPER_ADMIN role' },
    404: { description: 'Contributor not found' },
  },
});
