// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { z } from 'zod';

import { ChangelogStatus } from '../enums/changelog-status.enum.js';
import { UserRole } from '../enums/user-role.enum.js';

export const CreateChangelogEntryRequestSchema = z
  .object({
    productId: z.string(),
    title: z.string(),
    description: z.string(),
    version: z.string(),
    status: z.nativeEnum(ChangelogStatus),
  })
  .openapi('CreateChangelogEntryRequest');

export type CreateChangelogEntryRequest = z.infer<typeof CreateChangelogEntryRequestSchema>;

export const UpdateChangelogEntryRequestSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    version: z.string().optional(),
    status: z.nativeEnum(ChangelogStatus).optional(),
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
