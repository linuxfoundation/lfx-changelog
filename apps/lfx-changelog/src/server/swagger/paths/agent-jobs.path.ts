// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import { AgentJobQueryParamsSchema, AgentJobSchema, createApiResponseSchema, createPaginatedResponseSchema } from '@lfx-changelog/shared';

import { API_KEY_AUTH } from '../constants';

export const agentJobRegistry = new OpenAPIRegistry();

agentJobRegistry.registerPath({
  method: 'get',
  path: '/api/agent-jobs',
  tags: ['Agent Jobs'],
  summary: 'List agent jobs',
  description: 'Returns all agent jobs with optional filters.\n\n**Required privilege:** SUPER_ADMIN role.',
  security: API_KEY_AUTH,
  request: {
    query: AgentJobQueryParamsSchema.openapi('AgentJobQueryParams'),
  },
  responses: {
    200: {
      description: 'Paginated list of agent jobs',
      content: { 'application/json': { schema: createPaginatedResponseSchema(AgentJobSchema) } },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires SUPER_ADMIN role' },
  },
});

agentJobRegistry.registerPath({
  method: 'get',
  path: '/api/agent-jobs/{id}',
  tags: ['Agent Jobs'],
  summary: 'Get agent job by ID',
  description: 'Returns a single agent job with full progress log.\n\n**Required privilege:** SUPER_ADMIN role.',
  security: API_KEY_AUTH,
  request: {
    params: z.object({
      id: z.string().uuid().openapi({ description: 'Agent job ID' }),
    }),
  },
  responses: {
    200: {
      description: 'Single agent job',
      content: { 'application/json': { schema: createApiResponseSchema(AgentJobSchema) } },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires SUPER_ADMIN role' },
    404: { description: 'Agent job not found' },
  },
});

agentJobRegistry.registerPath({
  method: 'post',
  path: '/api/agent-jobs/trigger-blog/{type}',
  tags: ['Agent Jobs'],
  summary: 'Trigger blog agent run',
  description:
    'Triggers a blog agent run. Currently supports `monthly` type, which generates a monthly roundup.\n\n**Required privilege:** SUPER_ADMIN role or BLOGS_WRITE API key scope.',
  security: API_KEY_AUTH,
  request: {
    params: z.object({
      type: z.enum(['monthly']).openapi({ description: 'Blog trigger type' }),
    }),
    query: z.object({
      year: z.coerce
        .number()
        .int()
        .min(2020)
        .max(2100)
        .optional()
        .openapi({ description: 'Year for the roundup period. Both year and month must be provided together, or both omitted (defaults to previous month).' }),
      month: z.coerce.number().int().min(1).max(12).optional().openapi({
        description: 'Month for the roundup period (1-12). Both year and month must be provided together, or both omitted (defaults to previous month).',
      }),
    }),
  },
  responses: {
    202: {
      description: 'Blog agent job created and started',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({ jobId: z.string().uuid() }),
          }),
        },
      },
    },
    400: { description: 'Invalid type, year, or month' },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires SUPER_ADMIN role or BLOGS_WRITE scope' },
  },
});

agentJobRegistry.registerPath({
  method: 'post',
  path: '/api/agent-jobs/trigger/{productId}',
  tags: ['Agent Jobs'],
  summary: 'Manually trigger agent run',
  description: 'Triggers a new agent run for the specified product.\n\n**Required privilege:** SUPER_ADMIN role.',
  security: API_KEY_AUTH,
  request: {
    params: z.object({
      productId: z.string().uuid().openapi({ description: 'Product ID to run the agent for' }),
    }),
  },
  responses: {
    202: {
      description: 'Agent job created and started',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({ jobId: z.string().uuid() }),
          }),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires SUPER_ADMIN role' },
    404: { description: 'Product not found' },
  },
});
