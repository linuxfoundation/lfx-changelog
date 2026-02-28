// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { ApiClient } from '../api-client.js';

export function registerPublicResources(server: McpServer, apiClient: ApiClient): void {
  server.registerResource(
    'products',
    'lfx://products',
    {
      title: 'LFX Products',
      description: 'All active LFX products with their names, slugs, descriptions, and icons',
      mimeType: 'application/json',
    },
    async (uri) => {
      const result = await apiClient.get('/public/api/products');
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.registerResource(
    'changelogs',
    'lfx://changelogs',
    {
      title: 'Published Changelogs',
      description: 'Published changelog entries across all LFX products',
      mimeType: 'application/json',
    },
    async (uri) => {
      const result = await apiClient.get('/public/api/changelogs');
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );
}
