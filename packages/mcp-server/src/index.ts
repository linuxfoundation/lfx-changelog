#!/usr/bin/env node

// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createMcpServer } from './server.js';

const server = createMcpServer(process.env['BASE_URL'] || 'http://localhost:4204');

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('LFX Changelog MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
