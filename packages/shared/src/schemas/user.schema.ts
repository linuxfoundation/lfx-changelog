// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { z } from 'zod';

import { UserRole } from '../enums/user-role.enum.js';

export const UserRoleAssignmentSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    productId: z.string().nullable(),
    role: z.nativeEnum(UserRole),
  })
  .openapi('UserRoleAssignment');

export type UserRoleAssignment = z.infer<typeof UserRoleAssignmentSchema>;

export const UserSchema = z
  .object({
    id: z.string(),
    auth0Id: z.string(),
    email: z.string(),
    name: z.string(),
    avatarUrl: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    roles: z.array(UserRoleAssignmentSchema),
  })
  .openapi('User');

export type User = z.infer<typeof UserSchema>;
