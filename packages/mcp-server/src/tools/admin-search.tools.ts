// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { z } from 'zod';

import { AUTH_ERROR } from '../constants.js';
import { errorResult, jsonResult } from '../helpers.js';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { ApiClient } from '../api-client.js';

const reindexResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    indexed: z.number(),
    errors: z.number(),
  }),
});

export function registerAdminSearchTools(server: McpServer, apiClient: ApiClient): void {
  server.registerTool(
    'reindex-changelogs',
    {
      title: 'Reindex Changelogs (Admin)',
      description:
        'Trigger a full reindex of all published changelog entries into OpenSearch. Requires super_admin authentication. This deletes the existing index and rebuilds it from the database. Use when search results are stale or after bulk data changes.',
      outputSchema: reindexResponseSchema,
    },
    async () => {
      if (!apiClient.isAuthenticated) return AUTH_ERROR;

      try {
        return jsonResult(await apiClient.post('/api/opensearch/reindex', {}));
      } catch (error) {
        return errorResult('Error reindexing changelogs', error);
      }
    }
  );
}
