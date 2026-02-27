// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { z } from 'zod';

export const PublicProductSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    faIcon: z.string().nullable(),
  })
  .openapi('PublicProduct');

export type PublicProduct = z.infer<typeof PublicProductSchema>;

export const PublicAuthorSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    avatarUrl: z.string().nullable(),
  })
  .openapi('PublicAuthor');

export type PublicAuthor = z.infer<typeof PublicAuthorSchema>;

export const PublicChangelogEntrySchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    version: z.string().nullable(),
    status: z.string(),
    publishedAt: z.union([z.string(), z.date()]).nullable(),
    createdAt: z.union([z.string(), z.date()]),
    product: PublicProductSchema.optional(),
    author: PublicAuthorSchema.optional(),
  })
  .openapi('PublicChangelogEntry');

export type PublicChangelogEntry = z.infer<typeof PublicChangelogEntrySchema>;
