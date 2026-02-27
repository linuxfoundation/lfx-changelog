// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { z } from 'zod';

import { UserSchema } from './user.schema.js';

export const AuthUserSchema = z
  .object({
    sub: z.string(),
    email: z.string(),
    name: z.string(),
    picture: z.string(),
  })
  .openapi('AuthUser');

export type AuthUser = z.infer<typeof AuthUserSchema>;

export const AuthContextSchema = z
  .object({
    authenticated: z.boolean(),
    user: AuthUserSchema.nullable(),
    dbUser: UserSchema.nullable(),
  })
  .openapi('AuthContext');

export type AuthContext = z.infer<typeof AuthContextSchema>;
