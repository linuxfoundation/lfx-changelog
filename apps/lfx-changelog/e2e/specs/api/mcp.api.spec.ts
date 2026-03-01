// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { createApiKeyContext, createAuthenticatedContext, createUnauthenticatedContext } from '../../helpers/api.helper.js';

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

/** Invoke an MCP tool via JSON-RPC and return the parsed response. */
async function callMcpTool(ctx: APIRequestContext, toolName: string, args: Record<string, unknown> = {}, id = 1) {
  const res = await ctx.post('/mcp', {
    headers: MCP_HEADERS,
    data: { jsonrpc: '2.0', method: 'tools/call', params: { name: toolName, arguments: args }, id },
  });
  return parseJsonRpcResponse(res);
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

  test.describe('Tool listing', () => {
    test('should list all 13 tools (3 public + 10 admin)', async () => {
      const res = await api.post('/mcp', {
        headers: MCP_HEADERS,
        data: { jsonrpc: '2.0', method: 'tools/list', params: {}, id: 1 },
      });
      const body = await parseJsonRpcResponse(res);
      expect(body.result).toBeDefined();

      const toolNames: string[] = body.result.tools.map((t: any) => t.name);
      expect(toolNames).toHaveLength(13);

      // Public tools
      expect(toolNames).toContain('list-products');
      expect(toolNames).toContain('list-changelogs');
      expect(toolNames).toContain('get-changelog');

      // Admin product tools
      expect(toolNames).toContain('list-products-admin');
      expect(toolNames).toContain('get-product');
      expect(toolNames).toContain('create-product');
      expect(toolNames).toContain('update-product');
      expect(toolNames).toContain('delete-product');

      // Admin changelog tools
      expect(toolNames).toContain('list-draft-changelogs');
      expect(toolNames).toContain('create-changelog');
      expect(toolNames).toContain('update-changelog');
      expect(toolNames).toContain('publish-changelog');
      expect(toolNames).toContain('delete-changelog');
    });
  });

  test.describe('Public tools', () => {
    test('list-products returns products without auth', async () => {
      const body = await callMcpTool(api, 'list-products');
      expect(body.result).toBeDefined();
      expect(body.result.isError).toBeUndefined();

      const content = JSON.parse(body.result.content[0].text);
      expect(content.success).toBe(true);
      expect(Array.isArray(content.data)).toBe(true);
      expect(content.data.length).toBeGreaterThan(0);
      expect(content.data[0].name).toBeDefined();
      expect(content.data[0].slug).toBeDefined();
    });

    test('list-changelogs returns published entries without auth', async () => {
      const body = await callMcpTool(api, 'list-changelogs');
      expect(body.result).toBeDefined();
      expect(body.result.isError).toBeUndefined();

      const content = JSON.parse(body.result.content[0].text);
      expect(content.success).toBe(true);
      expect(Array.isArray(content.data)).toBe(true);
      expect(content.data.length).toBeGreaterThan(0);

      // Public endpoint only returns published entries
      for (const entry of content.data) {
        expect(entry.status).toBe('published');
      }
    });

    test('get-changelog returns a single entry by ID', async () => {
      // First get a changelog ID from the list
      const listBody = await callMcpTool(api, 'list-changelogs');
      const listContent = JSON.parse(listBody.result.content[0].text);
      const entryId = listContent.data[0].id;

      const body = await callMcpTool(api, 'get-changelog', { id: entryId });
      expect(body.result).toBeDefined();
      expect(body.result.isError).toBeUndefined();

      const content = JSON.parse(body.result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.data.id).toBe(entryId);
      expect(content.data.title).toBeDefined();
    });
  });

  test.describe('Admin tools — authentication', () => {
    test('returns auth error when calling admin tool without API key', async () => {
      const body = await callMcpTool(api, 'list-products-admin');
      expect(body.result).toBeDefined();
      expect(body.result.isError).toBe(true);
      expect(body.result.content[0].text).toContain('Authentication required');
    });

    test('returns error with invalid API key', async ({}, testInfo) => {
      const baseURL = testInfo.project.use.baseURL as string;
      const badKeyCtx = await createApiKeyContext('lfx_invalid_key_12345', baseURL);
      try {
        const body = await callMcpTool(badKeyCtx, 'list-products-admin');
        expect(body.result).toBeDefined();
        expect(body.result.isError).toBe(true);
      } finally {
        await badKeyCtx.dispose();
      }
    });
  });

  test.describe('Admin changelog tools', () => {
    let superAdminApi: APIRequestContext;
    let mcpFullApi: APIRequestContext;
    let fullKeyId: string;

    test.beforeAll(async ({}, testInfo) => {
      const baseURL = testInfo.project.use.baseURL as string;
      superAdminApi = await createAuthenticatedContext('super_admin', baseURL);

      // Create a full-access API key
      const createRes = await superAdminApi.post('/api/api-keys', {
        data: {
          name: 'mcp-changelog-test',
          scopes: ['changelogs:read', 'changelogs:write', 'products:read', 'products:write'],
          expiresInDays: 1,
        },
      });
      expect(createRes.status()).toBe(201);
      const { rawKey, apiKey } = (await createRes.json()).data;
      fullKeyId = apiKey.id;
      mcpFullApi = await createApiKeyContext(rawKey, baseURL);
    });

    test.afterAll(async () => {
      await superAdminApi.delete(`/api/api-keys/${fullKeyId}`);
      await Promise.all([superAdminApi.dispose(), mcpFullApi.dispose()]);
    });

    test('list-draft-changelogs returns entries', async () => {
      const body = await callMcpTool(mcpFullApi, 'list-draft-changelogs');
      expect(body.result).toBeDefined();
      expect(body.result.isError).toBeUndefined();

      const content = JSON.parse(body.result.content[0].text);
      expect(content.success).toBe(true);
      expect(Array.isArray(content.data)).toBe(true);
      expect(content.total).toBeGreaterThan(0);
    });

    test('create → update → publish → delete changelog lifecycle', async () => {
      // Discover a product ID via the admin MCP tool
      const productsBody = await callMcpTool(mcpFullApi, 'list-products-admin');
      const productsContent = JSON.parse(productsBody.result.content[0].text);
      const product = productsContent.data.find((p: any) => p.slug === 'e2e-easycla');
      expect(product).toBeDefined();
      const productId = product.id;

      // CREATE
      const createBody = await callMcpTool(mcpFullApi, 'create-changelog', {
        productId,
        title: 'MCP E2E Test Entry',
        description: '## Test\n\nCreated via MCP tool.',
        version: '99.0.0',
        status: 'draft',
      });
      expect(createBody.result.isError).toBeUndefined();
      const created = JSON.parse(createBody.result.content[0].text);
      expect(created.success).toBe(true);
      expect(created.data.title).toBe('MCP E2E Test Entry');
      expect(created.data.status).toBe('draft');
      const entryId = created.data.id;

      // UPDATE
      const updateBody = await callMcpTool(mcpFullApi, 'update-changelog', {
        id: entryId,
        title: 'MCP E2E Test Entry Updated',
      });
      expect(updateBody.result.isError).toBeUndefined();
      const updated = JSON.parse(updateBody.result.content[0].text);
      expect(updated.data.title).toBe('MCP E2E Test Entry Updated');

      // PUBLISH
      const publishBody = await callMcpTool(mcpFullApi, 'publish-changelog', { id: entryId });
      expect(publishBody.result.isError).toBeUndefined();
      const published = JSON.parse(publishBody.result.content[0].text);
      expect(published.data.status).toBe('published');
      expect(published.data.publishedAt).not.toBeNull();

      // DELETE
      const deleteBody = await callMcpTool(mcpFullApi, 'delete-changelog', { id: entryId });
      expect(deleteBody.result.isError).toBeUndefined();
    });
  });

  test.describe('Admin product tools', () => {
    let superAdminApi: APIRequestContext;
    let mcpFullApi: APIRequestContext;
    let fullKeyId: string;

    test.beforeAll(async ({}, testInfo) => {
      const baseURL = testInfo.project.use.baseURL as string;
      superAdminApi = await createAuthenticatedContext('super_admin', baseURL);

      // Create a full-access API key
      const createRes = await superAdminApi.post('/api/api-keys', {
        data: {
          name: 'mcp-product-test',
          scopes: ['changelogs:read', 'changelogs:write', 'products:read', 'products:write'],
          expiresInDays: 1,
        },
      });
      expect(createRes.status()).toBe(201);
      const { rawKey, apiKey } = (await createRes.json()).data;
      fullKeyId = apiKey.id;
      mcpFullApi = await createApiKeyContext(rawKey, baseURL);
    });

    test.afterAll(async () => {
      await superAdminApi.delete(`/api/api-keys/${fullKeyId}`);
      await Promise.all([superAdminApi.dispose(), mcpFullApi.dispose()]);
    });

    test('list-products-admin returns all products', async () => {
      const body = await callMcpTool(mcpFullApi, 'list-products-admin');
      expect(body.result).toBeDefined();
      expect(body.result.isError).toBeUndefined();

      const content = JSON.parse(body.result.content[0].text);
      expect(content.success).toBe(true);
      expect(Array.isArray(content.data)).toBe(true);
      expect(content.data.length).toBeGreaterThan(0);
    });

    test('get-product returns single product details', async () => {
      // Get a product ID first
      const listBody = await callMcpTool(mcpFullApi, 'list-products-admin');
      const listContent = JSON.parse(listBody.result.content[0].text);
      const product = listContent.data[0];

      const body = await callMcpTool(mcpFullApi, 'get-product', { id: product.id });
      expect(body.result).toBeDefined();
      expect(body.result.isError).toBeUndefined();

      const content = JSON.parse(body.result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.data.id).toBe(product.id);
      expect(content.data.name).toBe(product.name);
      expect(content.data.slug).toBeDefined();
    });
  });

  test.describe('Admin tools — scope enforcement', () => {
    let superAdminApi: APIRequestContext;
    let mcpReadApi: APIRequestContext;
    let readKeyId: string;

    test.beforeAll(async ({}, testInfo) => {
      const baseURL = testInfo.project.use.baseURL as string;
      superAdminApi = await createAuthenticatedContext('super_admin', baseURL);

      // Create a read-only API key (no write scopes)
      const createRes = await superAdminApi.post('/api/api-keys', {
        data: {
          name: 'mcp-readonly-test',
          scopes: ['changelogs:read', 'products:read'],
          expiresInDays: 1,
        },
      });
      expect(createRes.status()).toBe(201);
      const { rawKey, apiKey } = (await createRes.json()).data;
      readKeyId = apiKey.id;
      mcpReadApi = await createApiKeyContext(rawKey, baseURL);
    });

    test.afterAll(async () => {
      await superAdminApi.delete(`/api/api-keys/${readKeyId}`);
      await Promise.all([superAdminApi.dispose(), mcpReadApi.dispose()]);
    });

    test('read-only key can list admin changelogs', async () => {
      const body = await callMcpTool(mcpReadApi, 'list-draft-changelogs');
      expect(body.result).toBeDefined();
      expect(body.result.isError).toBeUndefined();

      const content = JSON.parse(body.result.content[0].text);
      expect(content.success).toBe(true);
    });

    test('read-only key can list admin products', async () => {
      const body = await callMcpTool(mcpReadApi, 'list-products-admin');
      expect(body.result).toBeDefined();
      expect(body.result.isError).toBeUndefined();

      const content = JSON.parse(body.result.content[0].text);
      expect(content.success).toBe(true);
    });

    test('read-only key cannot create a changelog (write scope missing)', async () => {
      // Get a product ID for the create payload
      const listBody = await callMcpTool(mcpReadApi, 'list-products-admin');
      const listContent = JSON.parse(listBody.result.content[0].text);
      const productId = listContent.data[0].id;

      const body = await callMcpTool(mcpReadApi, 'create-changelog', {
        productId,
        title: 'Should Fail',
        description: 'No write scope',
        version: '1.0.0',
        status: 'draft',
      });
      expect(body.result).toBeDefined();
      expect(body.result.isError).toBe(true);
    });

    test('read-only key cannot create a product (write scope missing)', async () => {
      const body = await callMcpTool(mcpReadApi, 'create-product', {
        name: 'Should Fail',
        slug: 'should-fail',
      });
      expect(body.result).toBeDefined();
      expect(body.result.isError).toBe(true);
    });
  });
});
