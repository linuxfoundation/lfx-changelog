// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { z } from 'zod';

import type { ZodType } from 'zod';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Creates a typed ApiResponse schema for a given data schema. */
export function createApiResponseSchema<T extends ZodType>(dataSchema: T) {
  return z.object({
    success: z.boolean(),
    data: dataSchema,
    message: z.string().optional(),
  });
}

/** Creates a typed PaginatedResponse schema for a given item schema. */
export function createPaginatedResponseSchema<T extends ZodType>(itemSchema: T) {
  return z.object({
    success: z.boolean(),
    data: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
    totalPages: z.number(),
  });
}
