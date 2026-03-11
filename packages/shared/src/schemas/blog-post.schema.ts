// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { z } from 'zod';

import { BlogPostStatus } from '../enums/blog-post-status.enum.js';
import { BlogPostType } from '../enums/blog-post-type.enum.js';
import { PublicAuthorSchema, PublicChangelogEntrySchema, PublicProductSchema } from './public.schema.js';

export const BlogPostSchema = z
  .object({
    id: z.string().uuid(),
    slug: z.string(),
    title: z.string(),
    excerpt: z.string().nullable(),
    description: z.string(),
    type: z.nativeEnum(BlogPostType),
    status: z.nativeEnum(BlogPostStatus),
    coverImageUrl: z.string().nullable(),
    publishedAt: z.string().nullable(),
    periodStart: z.string().nullable(),
    periodEnd: z.string().nullable(),
    createdBy: z.string().uuid(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('BlogPost');

export type BlogPost = z.infer<typeof BlogPostSchema>;

export const BlogPostWithRelationsSchema = BlogPostSchema.extend({
  author: PublicAuthorSchema.optional(),
  products: z.array(PublicProductSchema).optional(),
  changelogEntries: z.array(PublicChangelogEntrySchema).optional(),
}).openapi('BlogPostWithRelations');

export type BlogPostWithRelations = z.infer<typeof BlogPostWithRelationsSchema>;

export const BlogPostQueryParamsSchema = z
  .object({
    type: z.string().optional().openapi({ description: 'Filter by type (monthly_roundup, product_newsletter)' }),
    status: z.string().optional().openapi({ description: 'Filter by status (draft, published)' }),
    page: z.coerce.number().int().min(1).optional().openapi({ description: 'Page number' }),
    limit: z.coerce.number().int().min(1).max(100).optional().openapi({ description: 'Results per page (max: 100)' }),
  })
  .openapi('BlogPostQueryParams');

export type BlogPostQueryParams = z.infer<typeof BlogPostQueryParamsSchema>;
