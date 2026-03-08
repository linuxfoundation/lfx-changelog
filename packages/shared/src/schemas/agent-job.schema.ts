// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { z } from 'zod';

export const AgentJobStatusSchema = z.enum(['pending', 'running', 'completed', 'failed']).openapi('AgentJobStatus');

export const AgentJobTriggerSchema = z
  .enum(['webhook_push', 'webhook_release', 'webhook_pull_request', 'manual'])
  .openapi('AgentJobTrigger');

export const ProgressLogEntrySchema = z
  .object({
    timestamp: z.string(),
    type: z.enum(['tool_call', 'tool_result', 'text', 'error']),
    tool: z.string().optional(),
    summary: z.string(),
    args: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
      .optional()
      .openapi({ type: 'object', description: 'Tool call arguments' }),
  })
  .openapi('ProgressLogEntry');

export const AgentJobSchema = z
  .object({
    id: z.string().uuid(),
    productId: z.string().uuid(),
    trigger: AgentJobTriggerSchema,
    status: AgentJobStatusSchema,
    changelogId: z.string().uuid().nullable(),
    promptTokens: z.number().int().nullable(),
    outputTokens: z.number().int().nullable(),
    durationMs: z.number().int().nullable(),
    numTurns: z.number().int().nullable(),
    progressLog: z.array(ProgressLogEntrySchema),
    errorMessage: z.string().nullable(),
    createdAt: z.string(),
    startedAt: z.string().nullable(),
    completedAt: z.string().nullable(),
    updatedAt: z.string(),
  })
  .openapi('AgentJob');

export const AgentJobQueryParamsSchema = z.object({
  productId: z.string().uuid().optional(),
  status: AgentJobStatusSchema.optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

// Relation types matching backend Prisma includes
export const AgentJobProductSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
  })
  .openapi('AgentJobProduct');

export const AgentJobChangelogSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    status: z.string(),
  })
  .openapi('AgentJobChangelog');

export const AgentJobWithProductSchema = AgentJobSchema.extend({
  product: AgentJobProductSchema,
}).openapi('AgentJobWithProduct');

export const AgentJobDetailSchema = AgentJobSchema.extend({
  product: AgentJobProductSchema,
  changelogEntry: AgentJobChangelogSchema.nullable(),
}).openapi('AgentJobDetail');

export type AgentJobStatus = z.infer<typeof AgentJobStatusSchema>;
export type AgentJobTrigger = z.infer<typeof AgentJobTriggerSchema>;
export type ProgressLogEntry = z.infer<typeof ProgressLogEntrySchema>;
export type AgentJob = z.infer<typeof AgentJobSchema>;
export type AgentJobQueryParams = z.infer<typeof AgentJobQueryParamsSchema>;
export type AgentJobWithProduct = z.infer<typeof AgentJobWithProductSchema>;
export type AgentJobDetail = z.infer<typeof AgentJobDetailSchema>;
