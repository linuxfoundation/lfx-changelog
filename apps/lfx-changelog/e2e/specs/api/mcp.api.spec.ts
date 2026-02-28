// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { createUnauthenticatedContext } from '../../helpers/api.helper.js';

import type { APIRequestContext, APIResponse } from '@playwright/test';

const MCP_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };

/**
 * Parse a JSON-RPC body from an MCP response. The transport may reply with
 * plain JSON (`application/json`) or SSE (`text/event-stream`). This helper
 * handles both transparently.
 */
async function parseJsonRpcResponse(res: APIResponse): Promise<any> {
  const contentType = res.headers()['content-type'] ?? '';
  if (contentType.includes('text/event-stream')) {
    const text = await res.text();
    const dataLine = text.split('\n').find((l) => l.startsWith('data:'));
    return JSON.parse(dataLine!.slice('data:'.length).trim());
  }
  return res.json();
}

test.describe('MCP Endpoint (/mcp)', () => {
  let api: APIRequestContext;

  test.beforeAll(async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    api = await createUnauthenticatedContext(baseURL);
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test.describe('Initialize handshake', () => {
    test('should return 200 with valid JSON-RPC initialize response', async () => {
      const res = await api.post('/mcp', {
        headers: MCP_HEADERS,
        data: {
          jsonrpc: '2.0',
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: { name: 'e2e-test', version: '1.0.0' },
          },
          id: 1,
        },
      });

      expect(res.status()).toBe(200);

      const body = await parseJsonRpcResponse(res);
      expect(body.jsonrpc).toBe('2.0');
      expect(body.id).toBe(1);
      expect(body.result).toBeDefined();
      expect(body.result.serverInfo.name).toBe('lfx-changelog');
      expect(body.result.capabilities).toBeDefined();
      expect(body.result.capabilities.tools).toBeDefined();
      expect(body.result.capabilities.resources).toBeDefined();
    });
  });

  test.describe('Method not allowed', () => {
    test('GET /mcp should return 405 with JSON-RPC error', async () => {
      const res = await api.get('/mcp');
      expect(res.status()).toBe(405);

      const body = await res.json();
      expect(body.jsonrpc).toBe('2.0');
      expect(body.error.code).toBe(-32000);
      expect(body.error.message).toBe('Method not allowed.');
      expect(body.id).toBeNull();
    });

    test('DELETE /mcp should return 405 with JSON-RPC error', async () => {
      const res = await api.delete('/mcp');
      expect(res.status()).toBe(405);

      const body = await res.json();
      expect(body.jsonrpc).toBe('2.0');
      expect(body.error.code).toBe(-32000);
      expect(body.error.message).toBe('Method not allowed.');
      expect(body.id).toBeNull();
    });
  });

  test.describe('Invalid requests', () => {
    test('POST /mcp with malformed body should return a JSON-RPC error', async () => {
      const res = await api.post('/mcp', {
        headers: MCP_HEADERS,
        data: { invalid: 'not-jsonrpc' },
      });

      const body = await parseJsonRpcResponse(res);
      expect(body.jsonrpc).toBe('2.0');
      expect(body.error).toBeDefined();
      expect(body.error.code).toBeDefined();
    });
  });
});
