// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import { PublicProductSchema } from '@lfx-changelog/shared';

export const publicProductRegistry = new OpenAPIRegistry();

publicProductRegistry.registerPath({
  method: 'get',
  path: '/public/api/products',
  tags: ['Public - Products'],
  summary: 'List all products',
  description: 'Returns all LFX products.\n\n**Required privilege:** None — this endpoint is publicly accessible.',
  responses: {
    200: {
      description: 'List of products',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.array(PublicProductSchema),
          }),
        },
      },
    },
  },
});
