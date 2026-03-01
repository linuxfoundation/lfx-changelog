// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { ChangelogEntryWithRelationsSchema, createApiResponseSchema, createPaginatedResponseSchema } from '@lfx-changelog/shared/schemas';
import { z } from 'zod';

import { AUTH_ERROR } from '../constants.js';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { ApiClient } from '../api-client.js';

const changelogListResponseSchema = createPaginatedResponseSchema(ChangelogEntryWithRelationsSchema);
const changelogDetailResponseSchema = createApiResponseSchema(ChangelogEntryWithRelationsSchema);

export function registerAdminChangelogTools(server: McpServer, apiClient: ApiClient): void {
  server.registerTool(
    'list-draft-changelogs',
    {
      title: 'List Changelogs (Admin)',
      description:
        'List changelog entries including drafts. Requires authentication. Supports filtering by product, status, and pagination. Returns entries with full details including product and author relations.',
      inputSchema: {
        productId: z.string().optional().describe('Filter by product UUID'),
        status: z.enum(['draft', 'published']).optional().describe('Filter by status (draft or published)'),
        page: z.number().int().positive().optional().describe('Page number (1-based, default: 1)'),
        limit: z.number().int().positive().max(100).optional().describe('Items per page (default: 10, max: 100)'),
      },
      outputSchema: changelogListResponseSchema.shape,
    },
    async ({ productId, status, page, limit }) => {
      if (!apiClient.isAuthenticated) return AUTH_ERROR;

      try {
        const query: Record<string, string> = {};
        if (productId) query['productId'] = productId;
        if (status) query['status'] = status;
        if (page !== undefined) query['page'] = String(page);
        if (limit !== undefined) query['limit'] = String(limit);

        const result = await apiClient.get('/api/changelogs', query);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
          structuredContent: result as Record<string, unknown>,
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing changelogs: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'create-changelog',
    {
      title: 'Create Changelog Entry',
      description:
        'Create a new changelog entry. Requires authentication with changelogs:write scope. The entry can be created as a draft or published immediately.',
      inputSchema: {
        productId: z.string().describe('The UUID of the product this changelog belongs to'),
        title: z.string().describe('Title of the changelog entry'),
        description: z.string().describe('Changelog content in Markdown format'),
        version: z.string().describe('Version string (e.g. "1.2.0", "2025-02-28")'),
        status: z.enum(['draft', 'published']).describe('Initial status: "draft" to review later, "published" to publish immediately'),
      },
      outputSchema: changelogDetailResponseSchema.shape,
    },
    async ({ productId, title, description, version, status }) => {
      if (!apiClient.isAuthenticated) return AUTH_ERROR;

      try {
        const result = await apiClient.post('/api/changelogs', { productId, title, description, version, status });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
          structuredContent: result as Record<string, unknown>,
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error creating changelog: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'update-changelog',
    {
      title: 'Update Changelog Entry',
      description: 'Update an existing changelog entry. Requires authentication with changelogs:write scope. Only provided fields will be updated.',
      inputSchema: {
        id: z.string().describe('The UUID of the changelog entry to update'),
        title: z.string().optional().describe('New title'),
        description: z.string().optional().describe('New content in Markdown format'),
        version: z.string().optional().describe('New version string'),
        status: z.enum(['draft', 'published']).optional().describe('New status'),
      },
      outputSchema: changelogDetailResponseSchema.shape,
    },
    async ({ id, title, description, version, status }) => {
      if (!apiClient.isAuthenticated) return AUTH_ERROR;

      try {
        const body: Record<string, unknown> = {};
        if (title !== undefined) body['title'] = title;
        if (description !== undefined) body['description'] = description;
        if (version !== undefined) body['version'] = version;
        if (status !== undefined) body['status'] = status;

        const result = await apiClient.put(`/api/changelogs/${encodeURIComponent(id)}`, body);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
          structuredContent: result as Record<string, unknown>,
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error updating changelog: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'publish-changelog',
    {
      title: 'Publish Changelog Entry',
      description:
        'Publish a draft changelog entry, making it visible on the public changelog. Requires authentication with changelogs:write scope. Sets publishedAt to the current timestamp.',
      inputSchema: {
        id: z.string().describe('The UUID of the changelog entry to publish'),
      },
      outputSchema: changelogDetailResponseSchema.shape,
    },
    async ({ id }) => {
      if (!apiClient.isAuthenticated) return AUTH_ERROR;

      try {
        const result = await apiClient.patch(`/api/changelogs/${encodeURIComponent(id)}/publish`);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
          structuredContent: result as Record<string, unknown>,
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error publishing changelog: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'delete-changelog',
    {
      title: 'Delete Changelog Entry',
      description:
        'Permanently delete a changelog entry. Requires authentication with changelogs:write scope and product_admin role. This action cannot be undone.',
      inputSchema: {
        id: z.string().describe('The UUID of the changelog entry to delete'),
      },
    },
    async ({ id }) => {
      if (!apiClient.isAuthenticated) return AUTH_ERROR;

      try {
        await apiClient.delete(`/api/changelogs/${encodeURIComponent(id)}`);
        return {
          content: [{ type: 'text' as const, text: `Changelog entry ${id} deleted successfully.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error deleting changelog: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );
}
