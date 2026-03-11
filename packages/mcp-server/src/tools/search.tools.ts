// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { SearchResponseSchema, SearchTargetSchema } from '@lfx-changelog/shared/schemas';
import { z } from 'zod';

import { errorResult, jsonResult } from '../helpers.js';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { ApiClient } from '../api-client.js';

export function registerSearchTools(server: McpServer, apiClient: ApiClient): void {
  server.registerTool(
    'search',
    {
      title: 'Search',
      description:
        'Full-text search across published content using OpenSearch. Use target "changelogs" to search changelog entries or "blogs" to search blog posts. ' +
        'Returns matching entries ranked by relevance with highlighted fragments and facets for filtering. ' +
        'Changelogs support productId filtering and return product facets. Blogs support type filtering (e.g. "monthly_roundup") and return type facets.',
      inputSchema: z.object({
        target: SearchTargetSchema.describe('Which index to search: "changelogs" or "blogs"'),
        q: z.string().describe('Search query string (e.g. "security fix", "new API", "dark mode")'),
        productId: z.string().optional().describe('Filter by product UUID (changelogs only)'),
        type: z.string().optional().describe('Filter by blog type (blogs only, e.g. "monthly_roundup", "product_newsletter")'),
        page: z.number().int().positive().optional().describe('Page number (1-based, default: 1)'),
        limit: z.number().int().positive().max(100).optional().describe('Results per page (default: 20, max: 100)'),
      }),
      outputSchema: SearchResponseSchema,
    },
    async ({ target, q, productId, type, page, limit }) => {
      try {
        const query: Record<string, string> = { target, q };
        if (productId) query['productId'] = productId;
        if (type) query['type'] = type;
        if (page !== undefined) query['page'] = String(page);
        if (limit !== undefined) query['limit'] = String(limit);

        return jsonResult(await apiClient.get('/public/api/search', query));
      } catch (error) {
        return errorResult('Error searching', error);
      }
    }
  );
}
