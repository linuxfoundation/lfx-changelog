// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import {
  CreateProductRequestSchema,
  LinkRepositoryRequestSchema,
  ProductActivitySchema,
  ProductRepositorySchema,
  ProductSchema,
  UpdateProductRequestSchema,
} from '@lfx-changelog/shared';

export const productRegistry = new OpenAPIRegistry();

const cookieAuth = [{ cookieAuth: [] }];

productRegistry.registerPath({
  method: 'get',
  path: '/api/products',
  tags: ['Products'],
  summary: 'List all products',
  description: 'Returns all products.\n\n**Required privilege:** EDITOR role or above.',
  security: cookieAuth,
  responses: {
    200: {
      description: 'List of products',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.array(ProductSchema),
          }),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires EDITOR role or above' },
  },
});

productRegistry.registerPath({
  method: 'get',
  path: '/api/products/{id}',
  tags: ['Products'],
  summary: 'Get product by ID',
  description: 'Returns a single product.\n\n**Required privilege:** EDITOR role or above.',
  security: cookieAuth,
  request: {
    params: z.object({
      id: z.string().openapi({ description: 'Product ID' }),
    }),
  },
  responses: {
    200: {
      description: 'Single product',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: ProductSchema,
          }),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires EDITOR role or above' },
    404: { description: 'Product not found' },
  },
});

productRegistry.registerPath({
  method: 'post',
  path: '/api/products',
  tags: ['Products'],
  summary: 'Create product',
  description: 'Creates a new product.\n\n**Required privilege:** SUPER_ADMIN role.',
  security: cookieAuth,
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateProductRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Product created',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: ProductSchema,
          }),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires SUPER_ADMIN role' },
  },
});

productRegistry.registerPath({
  method: 'put',
  path: '/api/products/{id}',
  tags: ['Products'],
  summary: 'Update product',
  description: 'Updates an existing product.\n\n**Required privilege:** SUPER_ADMIN role.',
  security: cookieAuth,
  request: {
    params: z.object({
      id: z.string().openapi({ description: 'Product ID' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateProductRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Product updated',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: ProductSchema,
          }),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires SUPER_ADMIN role' },
    404: { description: 'Product not found' },
  },
});

productRegistry.registerPath({
  method: 'delete',
  path: '/api/products/{id}',
  tags: ['Products'],
  summary: 'Delete product',
  description: 'Deletes a product.\n\n**Required privilege:** SUPER_ADMIN role.',
  security: cookieAuth,
  request: {
    params: z.object({
      id: z.string().openapi({ description: 'Product ID' }),
    }),
  },
  responses: {
    204: { description: 'Product deleted' },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires SUPER_ADMIN role' },
    404: { description: 'Product not found' },
  },
});

productRegistry.registerPath({
  method: 'get',
  path: '/api/products/{id}/repositories',
  tags: ['Products'],
  summary: 'List linked repositories',
  description: 'Returns repositories linked to a product.\n\n**Required privilege:** EDITOR role or above.',
  security: cookieAuth,
  request: {
    params: z.object({
      id: z.string().openapi({ description: 'Product ID' }),
    }),
  },
  responses: {
    200: {
      description: 'List of linked repositories',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.array(ProductRepositorySchema),
          }),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires EDITOR role or above' },
    404: { description: 'Product not found' },
  },
});

productRegistry.registerPath({
  method: 'post',
  path: '/api/products/{id}/repositories',
  tags: ['Products'],
  summary: 'Link repository',
  description: 'Links a GitHub repository to a product.\n\n**Required privilege:** SUPER_ADMIN role.',
  security: cookieAuth,
  request: {
    params: z.object({
      id: z.string().openapi({ description: 'Product ID' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: LinkRepositoryRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Repository linked',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: ProductRepositorySchema,
          }),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires SUPER_ADMIN role' },
    404: { description: 'Product not found' },
  },
});

productRegistry.registerPath({
  method: 'delete',
  path: '/api/products/{id}/repositories/{repoId}',
  tags: ['Products'],
  summary: 'Unlink repository',
  description: 'Unlinks a GitHub repository from a product.\n\n**Required privilege:** SUPER_ADMIN role.',
  security: cookieAuth,
  request: {
    params: z.object({
      id: z.string().openapi({ description: 'Product ID' }),
      repoId: z.string().openapi({ description: 'Repository ID' }),
    }),
  },
  responses: {
    204: { description: 'Repository unlinked' },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires SUPER_ADMIN role' },
    404: { description: 'Product or repository not found' },
  },
});

productRegistry.registerPath({
  method: 'get',
  path: '/api/products/{id}/activity',
  tags: ['Products'],
  summary: 'Get product activity',
  description: 'Returns recent GitHub activity for a product (releases, PRs, commits).\n\n**Required privilege:** SUPER_ADMIN role.',
  security: cookieAuth,
  request: {
    params: z.object({
      id: z.string().openapi({ description: 'Product ID' }),
    }),
  },
  responses: {
    200: {
      description: 'Product activity',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: ProductActivitySchema,
          }),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires SUPER_ADMIN role' },
    404: { description: 'Product not found' },
  },
});
