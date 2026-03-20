// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { z } from 'zod';

import { AgentJobStatusSchema, ProgressLogEntrySchema } from './agent-job.schema.js';

export const AgentJobSSEEventTypeSchema = z.enum(['progress', 'status', 'stats', 'result', 'error', 'done']);

export const AgentJobSSEStatsSchema = z.object({
  durationMs: z.number().int(),
  numTurns: z.number().int(),
  promptTokens: z.number().int(),
  outputTokens: z.number().int(),
});

export const AgentJobSSEResultSchema = z.object({
  durationMs: z.number().int().nullable(),
  numTurns: z.number().int().nullable(),
  promptTokens: z.number().int().nullable(),
  outputTokens: z.number().int().nullable(),
  changelogEntry: z
    .object({
      id: z.string().uuid(),
      title: z.string(),
      status: z.string(),
    })
    .nullable(),
  errorMessage: z.string().nullable(),
});

export const AgentJobSSEEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('progress'), data: ProgressLogEntrySchema }),
  z.object({ type: z.literal('status'), data: z.object({ status: AgentJobStatusSchema }) }),
  z.object({ type: z.literal('stats'), data: AgentJobSSEStatsSchema }),
  z.object({ type: z.literal('result'), data: AgentJobSSEResultSchema }),
  z.object({ type: z.literal('error'), data: z.string() }),
  z.object({ type: z.literal('done'), data: z.literal('') }),
]);

export type AgentJobSSEEventType = z.infer<typeof AgentJobSSEEventTypeSchema>;
export type AgentJobSSEStats = z.infer<typeof AgentJobSSEStatsSchema>;
export type AgentJobSSEResult = z.infer<typeof AgentJobSSEResultSchema>;
export type AgentJobSSEEvent = z.infer<typeof AgentJobSSEEventSchema>;
