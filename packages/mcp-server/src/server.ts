// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { ApiClient } from './api-client.js';
import { registerPublicResources } from './resources/public.resources.js';
import { registerChangelogTools } from './tools/changelog.tools.js';
import { registerProductTools } from './tools/product.tools.js';

export function createMcpServer(apiBaseUrl: string): McpServer {
  const server = new McpServer({ name: 'lfx-changelog', version: '0.1.0' });
  const apiClient = new ApiClient(apiBaseUrl);

  registerProductTools(server, apiClient);
  registerChangelogTools(server, apiClient);
  registerPublicResources(server, apiClient);

  return server;
}
