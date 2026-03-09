// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { createApiResponseSchema, ProductSchema } from '@lfx-changelog/shared/schemas';
import { z } from 'zod';

import { AUTH_ERROR } from '../constants.js';
import { errorResult, jsonResult } from '../helpers.js';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { ApiClient } from '../api-client.js';

const productDetailResponseSchema = createApiResponseSchema(ProductSchema);
const productListResponseSchema = createApiResponseSchema(z.array(ProductSchema));

export function registerAdminProductTools(server: McpServer, apiClient: ApiClient): void {
  server.registerTool(
    'list-products-admin',
    {
      title: 'List Products (Admin)',
      description:
        'List all products including inactive ones. Requires authentication with products:read scope. Returns full product details including isActive status, GitHub installation, and repositories.',
      outputSchema: productListResponseSchema,
    },
    async () => {
      if (!apiClient.isAuthenticated) return AUTH_ERROR;

      try {
        return jsonResult(await apiClient.get('/api/products'));
      } catch (error) {
        return errorResult('Error listing products', error);
      }
    }
  );

  server.registerTool(
    'get-product',
    {
      title: 'Get Product (Admin)',
      description:
        'Get a single product by ID with full details. Requires authentication with products:read scope. Returns all fields including isActive, GitHub installation, and repositories.',
      inputSchema: z.object({
        id: z.string().describe('The UUID of the product'),
      }),
      outputSchema: productDetailResponseSchema,
    },
    async ({ id }) => {
      if (!apiClient.isAuthenticated) return AUTH_ERROR;

      try {
        return jsonResult(await apiClient.get(`/api/products/${encodeURIComponent(id)}`));
      } catch (error) {
        return errorResult('Error fetching product', error);
      }
    }
  );

  server.registerTool(
    'create-product',
    {
      title: 'Create Product',
      description: 'Create a new LFX product. Requires authentication with products:write scope and super_admin role. The product will be active by default.',
      inputSchema: z.object({
        name: z.string().describe('Display name of the product (e.g. "EasyCLA")'),
        slug: z.string().describe('URL-friendly slug (e.g. "easycla"). Must be unique.'),
        description: z.string().optional().describe('Short description of the product'),
        iconUrl: z.string().optional().describe('URL to the product icon image'),
        faIcon: z.string().optional().describe('Font Awesome icon class (e.g. "fa-duotone fa-file-contract")'),
      }),
      outputSchema: productDetailResponseSchema,
    },
    async ({ name, slug, description, iconUrl, faIcon }) => {
      if (!apiClient.isAuthenticated) return AUTH_ERROR;

      try {
        const body: Record<string, unknown> = { name, slug };
        if (description !== undefined) body['description'] = description;
        if (iconUrl !== undefined) body['iconUrl'] = iconUrl;
        if (faIcon !== undefined) body['faIcon'] = faIcon;

        return jsonResult(await apiClient.post('/api/products', body));
      } catch (error) {
        return errorResult('Error creating product', error);
      }
    }
  );

  server.registerTool(
    'update-product',
    {
      title: 'Update Product',
      description: 'Update an existing product. Requires authentication with products:write scope and super_admin role. Only provided fields will be updated.',
      inputSchema: z.object({
        id: z.string().describe('The UUID of the product to update'),
        name: z.string().optional().describe('New display name'),
        slug: z.string().optional().describe('New URL-friendly slug'),
        description: z.string().optional().describe('New description'),
        iconUrl: z.string().optional().describe('New icon URL'),
        faIcon: z.string().optional().describe('New Font Awesome icon class'),
        isActive: z.boolean().optional().describe('Set to false to deactivate the product'),
      }),
      outputSchema: productDetailResponseSchema,
    },
    async ({ id, name, slug, description, iconUrl, faIcon, isActive }) => {
      if (!apiClient.isAuthenticated) return AUTH_ERROR;

      try {
        const body: Record<string, unknown> = {};
        if (name !== undefined) body['name'] = name;
        if (slug !== undefined) body['slug'] = slug;
        if (description !== undefined) body['description'] = description;
        if (iconUrl !== undefined) body['iconUrl'] = iconUrl;
        if (faIcon !== undefined) body['faIcon'] = faIcon;
        if (isActive !== undefined) body['isActive'] = isActive;

        return jsonResult(await apiClient.put(`/api/products/${encodeURIComponent(id)}`, body));
      } catch (error) {
        return errorResult('Error updating product', error);
      }
    }
  );

  server.registerTool(
    'delete-product',
    {
      title: 'Delete Product',
      description:
        'Permanently delete a product and all its associated changelog entries. Requires authentication with products:write scope and super_admin role. This action cannot be undone.',
      inputSchema: z.object({
        id: z.string().describe('The UUID of the product to delete'),
      }),
    },
    async ({ id }) => {
      if (!apiClient.isAuthenticated) return AUTH_ERROR;

      try {
        await apiClient.delete(`/api/products/${encodeURIComponent(id)}`);
        return { content: [{ type: 'text' as const, text: `Product ${id} deleted successfully.` }] };
      } catch (error) {
        return errorResult('Error deleting product', error);
      }
    }
  );
}
