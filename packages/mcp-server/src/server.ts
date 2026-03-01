// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { ApiClient } from './api-client.js';
import { registerPublicResources } from './resources/public.resources.js';
import { registerAdminChangelogTools } from './tools/admin-changelog.tools.js';
import { registerAdminProductTools } from './tools/admin-product.tools.js';
import { registerChangelogTools } from './tools/changelog.tools.js';
import { registerProductTools } from './tools/product.tools.js';

export function createMcpServer(apiBaseUrl: string, apiKey?: string): McpServer {
  const server = new McpServer({ name: 'lfx-changelog', version: '0.1.0' });
  const apiClient = new ApiClient(apiBaseUrl, apiKey);

  // Public tools (no auth required)
  registerProductTools(server, apiClient);
  registerChangelogTools(server, apiClient);
  registerPublicResources(server, apiClient);

  // Admin tools (require API key)
  registerAdminChangelogTools(server, apiClient);
  registerAdminProductTools(server, apiClient);

  return server;
}
