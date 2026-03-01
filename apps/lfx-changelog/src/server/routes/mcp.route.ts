// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { createMcpServer } from '@lfx-changelog/mcp-server';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Router } from 'express';
import { serverLogger } from '../server-logger';

import type { Request, Response } from 'express';

const router = Router();

// POST /mcp — handle JSON-RPC requests (stateless: fresh server per request)
router.post('/', async (req: Request, res: Response) => {
  const apiKey = extractApiKey(req);
  const server = createMcpServer(process.env['BASE_URL'] || 'http://localhost:4204', apiKey);

  try {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    serverLogger.error({ err: error }, 'MCP request failed');
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

// GET & DELETE — not supported in stateless mode
router.get('/', (_req: Request, res: Response) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed.' },
    id: null,
  });
});

router.delete('/', (_req: Request, res: Response) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed.' },
    id: null,
  });
});

/**
 * Extract API key from the incoming request.
 * Checks Authorization: Bearer header first, then X-API-Key header.
 */
function extractApiKey(req: Request): string | undefined {
  const authHeader = req.headers['authorization'];
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7);
  }
  const xApiKey = req.headers['x-api-key'];
  if (typeof xApiKey === 'string') {
    return xApiKey;
  }
  return undefined;
}

export default router;
