// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { createApiResponseSchema, PublicProductSchema } from '@lfx-changelog/shared/schemas';
import { z } from 'zod';

import { errorResult, jsonResult } from '../helpers.js';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { ApiClient } from '../api-client.js';

const productListResponseSchema = createApiResponseSchema(z.array(PublicProductSchema));

export function registerProductTools(server: McpServer, apiClient: ApiClient): void {
  server.registerTool(
    'list-products',
    {
      title: 'List LFX Products',
      description: 'List all active LFX products. Returns each product with its id, name, slug, description, and Font Awesome icon class.',
      outputSchema: productListResponseSchema,
    },
    async () => {
      try {
        return jsonResult(await apiClient.get('/public/api/products'));
      } catch (error) {
        return errorResult('Error fetching products', error);
      }
    }
  );
}
