// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { createApiResponseSchema, createPaginatedResponseSchema, PublicChangelogEntrySchema } from '@lfx-changelog/shared/schemas';
import { z } from 'zod';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { ApiClient } from '../api-client.js';

// Override z.date() unions with z.string() for JSON Schema compatibility
const McpChangelogEntrySchema = PublicChangelogEntrySchema.extend({
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
});

const changelogListResponseSchema = createPaginatedResponseSchema(McpChangelogEntrySchema);
const changelogDetailResponseSchema = createApiResponseSchema(McpChangelogEntrySchema);

export function registerChangelogTools(server: McpServer, apiClient: ApiClient): void {
  server.registerTool(
    'list-changelogs',
    {
      title: 'List Published Changelogs',
      description:
        'List published changelog entries. Optionally filter by product ID and paginate results. Returns entries with title, description (markdown), version, published date, product, and author.',
      inputSchema: {
        productId: z.string().optional().describe('Filter changelogs by product UUID'),
        page: z.number().int().positive().optional().describe('Page number (1-based, default: 1)'),
        limit: z.number().int().positive().max(100).optional().describe('Items per page (default: 10, max: 100)'),
      },
      outputSchema: changelogListResponseSchema.shape,
    },
    async ({ productId, page, limit }) => {
      try {
        const query: Record<string, string> = {};
        if (productId) query['productId'] = productId;
        if (page !== undefined) query['page'] = String(page);
        if (limit !== undefined) query['limit'] = String(limit);

        const result = await apiClient.get('/public/api/changelogs', query);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
          structuredContent: result as Record<string, unknown>,
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error fetching changelogs: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'get-changelog',
    {
      title: 'Get Changelog Entry',
      description:
        'Get a single published changelog entry by its ID. Returns the full entry with title, description (markdown), version, status, published date, product, and author.',
      inputSchema: {
        id: z.string().describe('The UUID of the changelog entry'),
      },
      outputSchema: changelogDetailResponseSchema.shape,
    },
    async ({ id }) => {
      try {
        const result = await apiClient.get(`/public/api/changelogs/${encodeURIComponent(id)}`);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
          structuredContent: result as Record<string, unknown>,
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error fetching changelog: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );
}
