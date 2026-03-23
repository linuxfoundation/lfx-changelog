// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import { RoadmapBoardResponseSchema, RoadmapCommentSchema, RoadmapIdeaSchema, createApiResponseSchema } from '@lfx-changelog/shared';

export const publicRoadmapRegistry = new OpenAPIRegistry();

publicRoadmapRegistry.registerPath({
  method: 'get',
  path: '/public/api/roadmap',
  tags: ['Public - Roadmap'],
  summary: 'Get roadmap board',
  description:
    "Returns all roadmap ideas grouped by column (Now, Next, Later, Done, Won't do).\n\n" +
    '**Required privilege:** None — this endpoint is publicly accessible.',
  request: {
    query: z.object({
      team: z.string().optional().openapi({ description: 'Filter by team name (e.g. "PCC", "Insights")' }),
      includeCompleted: z.enum(['true', 'false']).optional().openapi({ description: "Include Done and Won't do columns (default: false)" }),
    }),
  },
  responses: {
    200: {
      description: 'Roadmap board data grouped by column',
      content: {
        'application/json': {
          schema: createApiResponseSchema(RoadmapBoardResponseSchema),
        },
      },
    },
  },
});

publicRoadmapRegistry.registerPath({
  method: 'get',
  path: '/public/api/roadmap/{jiraKey}',
  tags: ['Public - Roadmap'],
  summary: 'Get roadmap idea by Jira key',
  description: 'Returns a single roadmap idea by its Jira issue key.\n\n' + '**Required privilege:** None — this endpoint is publicly accessible.',
  request: {
    params: z.object({
      jiraKey: z.string().openapi({ description: 'Jira issue key (e.g. LFX-39)' }),
    }),
  },
  responses: {
    200: {
      description: 'Single roadmap idea',
      content: {
        'application/json': {
          schema: createApiResponseSchema(RoadmapIdeaSchema),
        },
      },
    },
    404: { description: 'Idea not found' },
  },
});

publicRoadmapRegistry.registerPath({
  method: 'get',
  path: '/public/api/roadmap/{jiraKey}/comments',
  tags: ['Public - Roadmap'],
  summary: 'Get comments for a roadmap idea',
  description:
    'Returns Jira comments for a roadmap idea, ordered newest first (max 50).\n\n' + '**Required privilege:** None — this endpoint is publicly accessible.',
  request: {
    params: z.object({
      jiraKey: z.string().openapi({ description: 'Jira issue key (e.g. LFX-39)' }),
    }),
  },
  responses: {
    200: {
      description: 'Array of comments',
      content: {
        'application/json': {
          schema: createApiResponseSchema(z.array(RoadmapCommentSchema)),
        },
      },
    },
  },
});
