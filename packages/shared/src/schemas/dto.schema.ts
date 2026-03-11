// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { z } from 'zod';

import { BlogPostStatus } from '../enums/blog-post-status.enum.js';
import { BlogPostType } from '../enums/blog-post-type.enum.js';
import { ChangelogStatus } from '../enums/changelog-status.enum.js';
import { UserRole } from '../enums/user-role.enum.js';

export const CreateChangelogEntryRequestSchema = z
  .object({
    productId: z.string(),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens (e.g. "my-changelog-entry")')
      .optional(),
    title: z.string(),
    description: z.string(),
    version: z.string(),
    status: z.nativeEnum(ChangelogStatus),
  })
  .openapi('CreateChangelogEntryRequest');

export type CreateChangelogEntryRequest = z.infer<typeof CreateChangelogEntryRequestSchema>;

export const UpdateChangelogEntryRequestSchema = z
  .object({
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens (e.g. "my-changelog-entry")')
      .optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    version: z.string().optional(),
    status: z.nativeEnum(ChangelogStatus).optional(),
    createdBy: z.string().optional(),
  })
  .openapi('UpdateChangelogEntryRequest');

export type UpdateChangelogEntryRequest = z.infer<typeof UpdateChangelogEntryRequestSchema>;

export const CreateProductRequestSchema = z
  .object({
    name: z.string(),
    slug: z.string(),
    description: z.string().optional(),
    iconUrl: z.string().optional(),
    faIcon: z.string().optional(),
  })
  .openapi('CreateProductRequest');

export type CreateProductRequest = z.infer<typeof CreateProductRequestSchema>;

export const UpdateProductRequestSchema = z
  .object({
    name: z.string().optional(),
    slug: z.string().optional(),
    description: z.string().optional(),
    iconUrl: z.string().optional(),
    faIcon: z.string().optional(),
    isActive: z.boolean().optional(),
  })
  .openapi('UpdateProductRequest');

export type UpdateProductRequest = z.infer<typeof UpdateProductRequestSchema>;

export const AssignRoleRequestSchema = z
  .object({
    productId: z.string().nullable(),
    role: z.nativeEnum(UserRole),
  })
  .openapi('AssignRoleRequest');

export type AssignRoleRequest = z.infer<typeof AssignRoleRequestSchema>;

export const CreateUserRequestSchema = z
  .object({
    email: z.string().email(),
    name: z.string().min(1),
    role: z.nativeEnum(UserRole),
    productId: z.string().optional(),
  })
  .openapi('CreateUserRequest');

export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;

// ── Blog Post DTOs ───────────────────────────

export const CreateBlogPostRequestSchema = z
  .object({
    title: z.string().min(1),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens')
      .optional(),
    excerpt: z.string().optional(),
    description: z.string(),
    type: z.nativeEnum(BlogPostType),
    status: z.nativeEnum(BlogPostStatus).optional(),
    coverImageUrl: z.string().url().optional(),
    periodStart: z.string().optional(),
    periodEnd: z.string().optional(),
    productIds: z.array(z.string().uuid()).optional(),
    changelogEntryIds: z.array(z.string().uuid()).optional(),
  })
  .openapi('CreateBlogPostRequest');

export type CreateBlogPostRequest = z.infer<typeof CreateBlogPostRequestSchema>;

export const UpdateBlogPostRequestSchema = z
  .object({
    title: z.string().min(1).optional(),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens')
      .optional(),
    excerpt: z.string().optional(),
    description: z.string().optional(),
    type: z.nativeEnum(BlogPostType).optional(),
    coverImageUrl: z.string().url().nullable().optional(),
    periodStart: z.string().nullable().optional(),
    periodEnd: z.string().nullable().optional(),
  })
  .openapi('UpdateBlogPostRequest');

export type UpdateBlogPostRequest = z.infer<typeof UpdateBlogPostRequestSchema>;

export const LinkBlogPostChangelogsRequestSchema = z
  .object({
    changelogEntryIds: z.array(z.string().uuid()),
  })
  .openapi('LinkBlogPostChangelogsRequest');

export type LinkBlogPostChangelogsRequest = z.infer<typeof LinkBlogPostChangelogsRequestSchema>;

export const LinkBlogPostProductsRequestSchema = z
  .object({
    productIds: z.array(z.string().uuid()),
  })
  .openapi('LinkBlogPostProductsRequest');

export type LinkBlogPostProductsRequest = z.infer<typeof LinkBlogPostProductsRequestSchema>;
