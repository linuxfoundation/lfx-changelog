// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import {
  ReleaseJobQueryParamsSchema,
  ReleaseJobSchema,
  ReleaseNotesPreviewSchema,
  ReleasePlanSchema,
  ReleasableServiceSchema,
  StartReleaseRequestSchema,
  UpdateServiceMappingRequestSchema,
  createApiResponseSchema,
  createPaginatedResponseSchema,
} from '@lfx-changelog/shared';

import { COOKIE_AUTH } from '../constants';

export const releaseJobRegistry = new OpenAPIRegistry();

releaseJobRegistry.registerPath({
  method: 'get',
  path: '/api/releasable-services',
  tags: ['Releasable Services'],
  summary: 'List services the caller may release',
  security: COOKIE_AUTH,
  responses: {
    200: {
      description: 'Permission-filtered catalog',
      content: { 'application/json': { schema: createApiResponseSchema(z.array(ReleasableServiceSchema)) } },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden' },
  },
});

releaseJobRegistry.registerPath({
  method: 'get',
  path: '/api/releasable-services/{key}/plan',
  tags: ['Releasable Services'],
  summary: 'Build a release plan',
  security: COOKIE_AUTH,
  request: { params: z.object({ key: z.string() }) },
  responses: {
    200: { description: 'Plan', content: { 'application/json': { schema: createApiResponseSchema(ReleasePlanSchema) } } },
    409: { description: 'Active job exists' },
    422: { description: 'Nothing to release' },
  },
});

releaseJobRegistry.registerPath({
  method: 'post',
  path: '/api/releasable-services/{key}/notes',
  tags: ['Releasable Services'],
  summary: 'Generate release notes',
  security: COOKIE_AUTH,
  request: { params: z.object({ key: z.string() }) },
  responses: {
    200: { description: 'Notes', content: { 'application/json': { schema: createApiResponseSchema(ReleaseNotesPreviewSchema) } } },
  },
});

releaseJobRegistry.registerPath({
  method: 'put',
  path: '/api/releasable-services/{key}/mapping',
  tags: ['Releasable Services'],
  summary: 'Map a service to a Changelog product',
  security: COOKIE_AUTH,
  request: {
    params: z.object({ key: z.string() }),
    body: { content: { 'application/json': { schema: UpdateServiceMappingRequestSchema } } },
  },
  responses: {
    200: { description: 'Mapping saved' },
    403: { description: 'Requires super_admin' },
  },
});

releaseJobRegistry.registerPath({
  method: 'get',
  path: '/api/release-jobs',
  tags: ['Release Jobs'],
  summary: 'Job history the caller may view',
  security: COOKIE_AUTH,
  request: { query: ReleaseJobQueryParamsSchema.openapi('ReleaseJobQueryParams') },
  responses: {
    200: { description: 'Paginated jobs', content: { 'application/json': { schema: createPaginatedResponseSchema(ReleaseJobSchema) } } },
  },
});

releaseJobRegistry.registerPath({
  method: 'post',
  path: '/api/release-jobs',
  tags: ['Release Jobs'],
  summary: 'Confirm a plan and start the job',
  security: COOKIE_AUTH,
  request: { body: { content: { 'application/json': { schema: StartReleaseRequestSchema } } } },
  responses: {
    202: { description: 'Job started', content: { 'application/json': { schema: createApiResponseSchema(ReleaseJobSchema) } } },
    409: { description: 'Active job exists' },
  },
});

releaseJobRegistry.registerPath({
  method: 'get',
  path: '/api/release-jobs/{id}',
  tags: ['Release Jobs'],
  summary: 'Job detail',
  security: COOKIE_AUTH,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Job', content: { 'application/json': { schema: createApiResponseSchema(ReleaseJobSchema) } } },
  },
});

releaseJobRegistry.registerPath({
  method: 'get',
  path: '/api/release-jobs/{id}/stream',
  tags: ['Release Jobs'],
  summary: 'SSE progress events',
  security: COOKIE_AUTH,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: 'text/event-stream' } },
});

releaseJobRegistry.registerPath({
  method: 'post',
  path: '/api/release-jobs/{id}/cancel',
  tags: ['Release Jobs'],
  summary: 'Cancel a waiting job',
  security: COOKIE_AUTH,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: 'Cancelled' }, 409: { description: 'Not waiting' } },
});

releaseJobRegistry.registerPath({
  method: 'post',
  path: '/api/release-jobs/{id}/retry',
  tags: ['Release Jobs'],
  summary: 'Retry remaining steps',
  security: COOKIE_AUTH,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 202: { description: 'Retry started' } },
});

releaseJobRegistry.registerPath({
  method: 'post',
  path: '/api/release-jobs/{id}/refresh-sync',
  tags: ['Release Jobs'],
  summary: 'Re-read Argo CD status',
  security: COOKIE_AUTH,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: 'Updated job', content: { 'application/json': { schema: createApiResponseSchema(ReleaseJobSchema) } } } },
});
