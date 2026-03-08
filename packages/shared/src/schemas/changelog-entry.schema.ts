// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { z } from 'zod';

import { ChangelogSource } from '../enums/changelog-source.enum.js';
import { ChangelogStatus } from '../enums/changelog-status.enum.js';
import { ProductSchema } from './product.schema.js';
import { UserSchema } from './user.schema.js';

export const ChangelogEntrySchema = z
  .object({
    id: z.string(),
    productId: z.string(),
    slug: z.string().nullable(),
    title: z.string(),
    description: z.string(),
    version: z.string().nullable(),
    source: z.nativeEnum(ChangelogSource).optional(),
    status: z.nativeEnum(ChangelogStatus),
    publishedAt: z.string().nullable(),
    createdBy: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('ChangelogEntry');

export type ChangelogEntry = z.infer<typeof ChangelogEntrySchema>;

export const ChangelogEntryWithRelationsSchema = ChangelogEntrySchema.extend({
  product: ProductSchema.optional(),
  author: UserSchema.optional(),
}).openapi('ChangelogEntryWithRelations');

export type ChangelogEntryWithRelations = z.infer<typeof ChangelogEntryWithRelationsSchema>;
