// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import { AgentJobSchema, AgentJobStatusSchema, createApiResponseSchema, createPaginatedResponseSchema } from '@lfx-changelog/shared';

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
    query: z.object({
      productId: z.string().uuid().optional().openapi({ description: 'Filter by product ID' }),
      status: AgentJobStatusSchema.optional().openapi({ description: 'Filter by status' }),
      page: z.coerce.number().optional().openapi({ description: 'Page number (default: 1)' }),
      limit: z.coerce.number().optional().openapi({ description: 'Items per page (default: 20, max: 100)' }),
    }),
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
