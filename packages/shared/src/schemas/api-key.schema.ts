// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { z } from 'zod';

import { ApiKeyScope } from '../enums/api-key-scope.enum.js';

export const ApiKeySchema = z
  .object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    name: z.string(),
    keyPrefix: z.string(),
    scopes: z.array(z.nativeEnum(ApiKeyScope)),
    expiresAt: z.string(),
    lastUsedAt: z.string().nullable(),
    revokedAt: z.string().nullable(),
    createdAt: z.string(),
  })
  .openapi('ApiKey');

export type ApiKey = z.infer<typeof ApiKeySchema>;

export const CreateApiKeyRequestSchema = z
  .object({
    name: z.string().min(1).max(100),
    scopes: z.array(z.nativeEnum(ApiKeyScope)).min(1),
    expiresInDays: z.number().int().min(1).max(365),
  })
  .openapi('CreateApiKeyRequest');

export type CreateApiKeyRequest = z.infer<typeof CreateApiKeyRequestSchema>;

export const CreateApiKeyResponseSchema = z
  .object({
    apiKey: ApiKeySchema,
    rawKey: z.string(),
  })
  .openapi('CreateApiKeyResponse');

export type CreateApiKeyResponse = z.infer<typeof CreateApiKeyResponseSchema>;

export interface ApiKeyScopeMetadata {
  scope: ApiKeyScope;
  label: string;
  description: string;
  resource: string;
  action: string;
  color: string;
}
