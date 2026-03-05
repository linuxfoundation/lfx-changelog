// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { z } from 'zod';

// ── Response schemas ──────────────────────────────────────────────────

export const UnseenCountSchema = z
  .object({
    productId: z.string().uuid(),
    unseenCount: z.number().int().min(0),
    lastViewedAt: z.string().nullable(),
  })
  .openapi('UnseenCount');

export type UnseenCount = z.infer<typeof UnseenCountSchema>;

export const MarkViewedResponseSchema = z
  .object({
    productId: z.string().uuid(),
    lastViewedAt: z.string(),
  })
  .openapi('MarkViewedResponse');

export type MarkViewedResponse = z.infer<typeof MarkViewedResponseSchema>;

// ── Request schemas ───────────────────────────────────────────────────

export const MarkViewedRequestSchema = z
  .object({
    viewerId: z.string().min(1).optional(),
    productId: z.string().uuid().optional(),
    productIds: z.array(z.string().uuid()).optional(),
  })
  .refine((data) => data.productId || (data.productIds && data.productIds.length > 0), {
    message: 'Either productId or productIds must be provided',
  })
  .openapi('MarkViewedRequest');

export type MarkViewedRequest = z.infer<typeof MarkViewedRequestSchema>;

export const UnseenQuerySchema = z
  .object({
    viewerId: z.string().min(1).optional(),
    productId: z.string().uuid().optional(),
    productIds: z.union([z.string(), z.array(z.string())]).optional(),
  })
  .openapi('UnseenQuery');

export type UnseenQuery = z.infer<typeof UnseenQuerySchema>;
