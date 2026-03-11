// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { z } from 'zod';

import { AUTH_ERROR } from '../constants.js';
import { errorResult, jsonResult } from '../helpers.js';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { ApiClient } from '../api-client.js';

const reindexResultSchema = z.object({
  indexed: z.number(),
  errors: z.number(),
});

const reindexResponseSchema = z.object({
  success: z.boolean(),
  data: z.record(z.string(), reindexResultSchema),
});

export function registerAdminSearchTools(server: McpServer, apiClient: ApiClient): void {
  server.registerTool(
    'reindex',
    {
      title: 'Reindex OpenSearch (Admin)',
      description:
        'Trigger a full reindex of OpenSearch indices from the database. Requires super_admin authentication. ' +
        'Use target "changelogs" to reindex changelog entries, "blogs" to reindex blog posts, or "all" to reindex both. ' +
        'This deletes the existing index and rebuilds it. Use when search results are stale or after bulk data changes.',
      inputSchema: z.object({
        target: z.enum(['changelogs', 'blogs', 'all']).default('all').describe('Which index to reindex (default: all)'),
      }),
      outputSchema: reindexResponseSchema,
    },
    async ({ target }) => {
      if (!apiClient.isAuthenticated) return AUTH_ERROR;

      try {
        return jsonResult(await apiClient.post(`/api/opensearch/reindex?target=${target}`, {}));
      } catch (error) {
        return errorResult('Error reindexing', error);
      }
    }
  );
}
