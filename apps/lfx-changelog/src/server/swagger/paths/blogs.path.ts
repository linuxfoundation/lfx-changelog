// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import {
  BlogPostWithRelationsSchema,
  CreateBlogPostRequestSchema,
  LinkBlogPostChangelogsRequestSchema,
  LinkBlogPostProductsRequestSchema,
  UpdateBlogPostRequestSchema,
  createApiResponseSchema,
  createPaginatedResponseSchema,
} from '@lfx-changelog/shared';

import { API_KEY_AUTH, COOKIE_AUTH } from '../constants';

export const blogPostRegistry = new OpenAPIRegistry();

// ── Public endpoints ───────────────────────────

blogPostRegistry.registerPath({
  method: 'get',
  path: '/public/api/blog',
  tags: ['Public - Blog'],
  summary: 'List published blog posts',
  description: 'Returns a paginated list of published blog posts with optional type filter. No authentication required.',
  request: {
    query: z.object({
      type: z.string().optional().openapi({ description: 'Filter by type (monthly_roundup, product_newsletter)' }),
      page: z.string().optional().openapi({ description: 'Page number (default 1)' }),
      limit: z.string().optional().openapi({ description: 'Page size (default 20, max 100)' }),
    }),
  },
  responses: {
    200: {
      description: 'Paginated list of published blog posts',
      content: { 'application/json': { schema: createPaginatedResponseSchema(BlogPostWithRelationsSchema) } },
    },
  },
});

blogPostRegistry.registerPath({
  method: 'get',
  path: '/public/api/blog/{slug}',
  tags: ['Public - Blog'],
  summary: 'Get published blog post by slug',
  description: 'Returns a single published blog post by its slug. No authentication required.',
  request: {
    params: z.object({ slug: z.string().openapi({ description: 'Blog post slug' }) }),
  },
  responses: {
    200: {
      description: 'Single published blog post',
      content: { 'application/json': { schema: createApiResponseSchema(BlogPostWithRelationsSchema) } },
    },
    404: { description: 'Blog post not found' },
  },
});

// ── Admin endpoints ────────────────────────────

blogPostRegistry.registerPath({
  method: 'get',
  path: '/api/blogs',
  tags: ['Blog Posts'],
  summary: 'List all blog posts',
  description: 'Returns all blog posts with optional filters.\n\n**Required privilege:** EDITOR role or above, or `blogs:read` API key scope.',
  security: [...API_KEY_AUTH, ...COOKIE_AUTH],
  request: {
    query: z.object({
      type: z.string().optional().openapi({ description: 'Filter by type' }),
      status: z.string().optional().openapi({ description: 'Filter by status (draft/published)' }),
      page: z.string().optional().openapi({ description: 'Page number (default 1)' }),
      limit: z.string().optional().openapi({ description: 'Page size (default 20, max 100)' }),
    }),
  },
  responses: {
    200: {
      description: 'Paginated list of blog posts',
      content: { 'application/json': { schema: createPaginatedResponseSchema(BlogPostWithRelationsSchema) } },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden' },
  },
});

blogPostRegistry.registerPath({
  method: 'get',
  path: '/api/blogs/{id}',
  tags: ['Blog Posts'],
  summary: 'Get blog post by ID',
  description: 'Returns a single blog post with all relations.\n\n**Required privilege:** EDITOR role or above, or `blogs:read` API key scope.',
  security: [...API_KEY_AUTH, ...COOKIE_AUTH],
  request: {
    params: z.object({ id: z.string().openapi({ description: 'Blog post ID' }) }),
  },
  responses: {
    200: {
      description: 'Single blog post',
      content: { 'application/json': { schema: createApiResponseSchema(BlogPostWithRelationsSchema) } },
    },
    401: { description: 'Unauthorized' },
    404: { description: 'Blog post not found' },
  },
});

blogPostRegistry.registerPath({
  method: 'post',
  path: '/api/blogs',
  tags: ['Blog Posts'],
  summary: 'Create blog post',
  description: 'Creates a new blog post draft.\n\n**Required privilege:** PRODUCT_ADMIN role or above, or `blogs:write` API key scope.',
  security: [...API_KEY_AUTH, ...COOKIE_AUTH],
  request: {
    body: { content: { 'application/json': { schema: CreateBlogPostRequestSchema } } },
  },
  responses: {
    201: {
      description: 'Blog post created',
      content: { 'application/json': { schema: createApiResponseSchema(BlogPostWithRelationsSchema) } },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden' },
  },
});

blogPostRegistry.registerPath({
  method: 'put',
  path: '/api/blogs/{id}',
  tags: ['Blog Posts'],
  summary: 'Update blog post',
  description: 'Updates an existing blog post.\n\n**Required privilege:** EDITOR role or above, or `blogs:write` API key scope.',
  security: [...API_KEY_AUTH, ...COOKIE_AUTH],
  request: {
    params: z.object({ id: z.string().openapi({ description: 'Blog post ID' }) }),
    body: { content: { 'application/json': { schema: UpdateBlogPostRequestSchema } } },
  },
  responses: {
    200: {
      description: 'Blog post updated',
      content: { 'application/json': { schema: createApiResponseSchema(BlogPostWithRelationsSchema) } },
    },
    401: { description: 'Unauthorized' },
    404: { description: 'Blog post not found' },
  },
});

blogPostRegistry.registerPath({
  method: 'patch',
  path: '/api/blogs/{id}/publish',
  tags: ['Blog Posts'],
  summary: 'Publish blog post',
  description: 'Publishes a draft blog post.\n\n**Required privilege:** EDITOR role or above, or `blogs:write` API key scope.',
  security: [...API_KEY_AUTH, ...COOKIE_AUTH],
  request: {
    params: z.object({ id: z.string().openapi({ description: 'Blog post ID' }) }),
  },
  responses: {
    200: {
      description: 'Blog post published',
      content: { 'application/json': { schema: createApiResponseSchema(BlogPostWithRelationsSchema) } },
    },
    401: { description: 'Unauthorized' },
    404: { description: 'Blog post not found' },
  },
});

blogPostRegistry.registerPath({
  method: 'patch',
  path: '/api/blogs/{id}/unpublish',
  tags: ['Blog Posts'],
  summary: 'Unpublish blog post',
  description: 'Reverts a published blog post to draft.\n\n**Required privilege:** EDITOR role or above, or `blogs:write` API key scope.',
  security: [...API_KEY_AUTH, ...COOKIE_AUTH],
  request: {
    params: z.object({ id: z.string().openapi({ description: 'Blog post ID' }) }),
  },
  responses: {
    200: {
      description: 'Blog post unpublished',
      content: { 'application/json': { schema: createApiResponseSchema(BlogPostWithRelationsSchema) } },
    },
    401: { description: 'Unauthorized' },
    404: { description: 'Blog post not found' },
  },
});

blogPostRegistry.registerPath({
  method: 'delete',
  path: '/api/blogs/{id}',
  tags: ['Blog Posts'],
  summary: 'Delete blog post',
  description: 'Deletes a blog post.\n\n**Required privilege:** SUPER_ADMIN role, or `blogs:write` API key scope.',
  security: [...API_KEY_AUTH, ...COOKIE_AUTH],
  request: {
    params: z.object({ id: z.string().openapi({ description: 'Blog post ID' }) }),
  },
  responses: {
    204: { description: 'Blog post deleted' },
    401: { description: 'Unauthorized' },
    404: { description: 'Blog post not found' },
  },
});

blogPostRegistry.registerPath({
  method: 'post',
  path: '/api/blogs/{id}/link-products',
  tags: ['Blog Posts'],
  summary: 'Link products to blog post',
  description: 'Replaces the product associations for a blog post.\n\n**Required privilege:** PRODUCT_ADMIN role or above, or `blogs:write` API key scope.',
  security: [...API_KEY_AUTH, ...COOKIE_AUTH],
  request: {
    params: z.object({ id: z.string().openapi({ description: 'Blog post ID' }) }),
    body: { content: { 'application/json': { schema: LinkBlogPostProductsRequestSchema } } },
  },
  responses: {
    200: {
      description: 'Products linked',
      content: { 'application/json': { schema: createApiResponseSchema(BlogPostWithRelationsSchema) } },
    },
    401: { description: 'Unauthorized' },
    404: { description: 'Blog post not found' },
  },
});

blogPostRegistry.registerPath({
  method: 'post',
  path: '/api/blogs/{id}/link-changelogs',
  tags: ['Blog Posts'],
  summary: 'Link changelog entries to blog post',
  description:
    'Replaces the changelog entry associations for a blog post.\n\n**Required privilege:** PRODUCT_ADMIN role or above, or `blogs:write` API key scope.',
  security: [...API_KEY_AUTH, ...COOKIE_AUTH],
  request: {
    params: z.object({ id: z.string().openapi({ description: 'Blog post ID' }) }),
    body: { content: { 'application/json': { schema: LinkBlogPostChangelogsRequestSchema } } },
  },
  responses: {
    200: {
      description: 'Changelog entries linked',
      content: { 'application/json': { schema: createApiResponseSchema(BlogPostWithRelationsSchema) } },
    },
    401: { description: 'Unauthorized' },
    404: { description: 'Blog post not found' },
  },
});
