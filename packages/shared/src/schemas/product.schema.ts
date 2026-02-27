// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { z } from 'zod';

import { ProductRepositorySchema } from './github.schema.js';

export const ProductSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    iconUrl: z.string().nullable(),
    faIcon: z.string().nullable(),
    isActive: z.boolean(),
    githubInstallationId: z.number().int().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    repositories: z.array(ProductRepositorySchema).optional(),
  })
  .openapi('Product');

export type Product = z.infer<typeof ProductSchema>;
