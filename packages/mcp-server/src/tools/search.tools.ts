// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { SearchResponseSchema } from '@lfx-changelog/shared/schemas';
import { z } from 'zod';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { ApiClient } from '../api-client.js';

export function registerSearchTools(server: McpServer, apiClient: ApiClient): void {
  server.registerTool(
    'search-changelogs',
    {
      title: 'Search Changelogs',
      description:
        'Full-text search across published changelog entries using OpenSearch. Returns matching entries ranked by relevance with highlighted fragments and product facets for filtering. Use this instead of list-changelogs when the user wants to find specific content by keyword.',
      inputSchema: {
        q: z.string().describe('Search query string (e.g. "security fix", "new API", "dark mode")'),
        productId: z.string().optional().describe('Filter results by product UUID'),
        page: z.number().int().positive().optional().describe('Page number (1-based, default: 1)'),
        limit: z.number().int().positive().max(100).optional().describe('Results per page (default: 20, max: 100)'),
      },
      outputSchema: SearchResponseSchema.shape,
    },
    async ({ q, productId, page, limit }) => {
      try {
        const query: Record<string, string> = { q };
        if (productId) query['productId'] = productId;
        if (page !== undefined) query['page'] = String(page);
        if (limit !== undefined) query['limit'] = String(limit);

        const result = await apiClient.get('/public/api/changelogs/search', query);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
          structuredContent: result as Record<string, unknown>,
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error searching changelogs: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );
}
