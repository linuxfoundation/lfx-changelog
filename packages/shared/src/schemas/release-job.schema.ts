// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { z } from 'zod';

export const ReleaseJobStatusSchema = z.enum(['pending', 'running', 'waiting_for_approval', 'completed', 'failed', 'cancelled']).openapi('ReleaseJobStatus');

export const ReleaseProgressTypeSchema = z.enum(['info', 'success', 'error', 'skip']).openapi('ReleaseProgressType');

export const ReleaseProgressLineSchema = z
  .object({
    timestamp: z.string(),
    step: z.string(),
    type: ReleaseProgressTypeSchema,
    summary: z.string(),
    environment: z.string().nullable().optional(),
  })
  .openapi('ReleaseProgressLine');

export const EnvironmentSyncRequestStatusSchema = z.enum(['pending', 'accepted', 'failed', 'skipped']).openapi('EnvironmentSyncRequestStatus');

export const EnvironmentSyncSchema = z
  .object({
    environment: z.string(),
    applicationName: z.string(),
    requestStatus: EnvironmentSyncRequestStatusSchema,
    lastSyncStatus: z.string().nullable(),
    lastHealth: z.string().nullable(),
    lastRefreshedAt: z.string().nullable(),
  })
  .openapi('EnvironmentSync');

export const ReleasableServiceSchema = z
  .object({
    key: z.string(),
    displayName: z.string(),
    githubRepo: z.string(),
    productId: z.string().uuid().nullable(),
    latestTag: z.string(),
    pendingCount: z.number().int(),
    environments: z.array(z.string()),
    canRelease: z.boolean(),
    auditError: z.string().nullable(),
    activeJobId: z.string().uuid().nullable(),
  })
  .openapi('ReleasableService');

export const PendingChangeSchema = z
  .object({
    number: z.number().int(),
    title: z.string(),
    author: z.string(),
    mergedAt: z.string(),
  })
  .openapi('PendingChange');

export const ReleasePlanSchema = z
  .object({
    service: ReleasableServiceSchema,
    latestTag: z.string(),
    newTag: z.string(),
    argocdTag: z.string(),
    headSha: z.string().nullable(),
    pending: z.array(PendingChangeSchema),
    environments: z.array(z.string()),
    steps: z.array(z.string()),
  })
  .openapi('ReleasePlan');

export const ReleaseNotesPreviewSchema = z
  .object({
    notes: z.string(),
  })
  .openapi('ReleaseNotesPreview');

export const StartReleaseRequestSchema = z
  .object({
    serviceKey: z.string().min(1),
    notes: z.string().trim().min(1),
    newTag: z.string().min(1),
    headSha: z.string().nullable(),
  })
  .openapi('StartReleaseRequest');

export const UpdateServiceMappingRequestSchema = z
  .object({
    productId: z.string().uuid().nullable(),
  })
  .openapi('UpdateServiceMappingRequest');

export const GenerateNotesRequestSchema = z
  .object({
    regenerate: z.boolean().optional().default(true),
  })
  .openapi('GenerateNotesRequest');

export const ReleaseJobSchema = z
  .object({
    id: z.string().uuid(),
    serviceKey: z.string(),
    status: ReleaseJobStatusSchema,
    requesterId: z.string().uuid(),
    latestTag: z.string(),
    newTag: z.string(),
    releaseUrl: z.string().nullable(),
    ciStatus: z.string().nullable(),
    ciRunUrl: z.string().nullable(),
    argocdPrUrl: z.string().nullable(),
    bumpOutcome: z.string().nullable().optional(),
    bumpRunUrl: z.string().nullable().optional(),
    mergeQueuedAt: z.string().nullable().optional(),
    progressLog: z.array(ReleaseProgressLineSchema),
    environmentSyncs: z.array(EnvironmentSyncSchema).optional(),
    errorMessage: z.string().nullable(),
  })
  .openapi('ReleaseJob');

export const ReleaseJobQueryParamsSchema = z.object({
  serviceKey: z.string().optional(),
  status: ReleaseJobStatusSchema.optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const ActiveJobConflictSchema = z
  .object({
    success: z.boolean(),
    error: z.string(),
    data: z.object({
      jobId: z.string().uuid(),
      status: z.string(),
    }),
  })
  .openapi('ActiveJobConflict');

export const ReleaseJobSSEEventSchema = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('progress'), data: ReleaseProgressLineSchema }),
    z.object({ type: z.literal('status'), data: z.object({ status: ReleaseJobStatusSchema }) }),
    z.object({ type: z.literal('error'), data: z.string() }),
    z.object({ type: z.literal('done'), data: z.literal('') }),
  ])
  .openapi('ReleaseJobSSEEvent');

export type ReleaseJobStatus = z.infer<typeof ReleaseJobStatusSchema>;
export type ReleaseProgressType = z.infer<typeof ReleaseProgressTypeSchema>;
export type ReleaseProgressLine = z.infer<typeof ReleaseProgressLineSchema>;
export type EnvironmentSync = z.infer<typeof EnvironmentSyncSchema>;
export type ReleasableService = z.infer<typeof ReleasableServiceSchema>;
export type PendingChange = z.infer<typeof PendingChangeSchema>;
export type ReleasePlan = z.infer<typeof ReleasePlanSchema>;
export type ReleaseNotesPreview = z.infer<typeof ReleaseNotesPreviewSchema>;
export type StartReleaseRequest = z.infer<typeof StartReleaseRequestSchema>;
export type UpdateServiceMappingRequest = z.infer<typeof UpdateServiceMappingRequestSchema>;
export type GenerateNotesRequest = z.infer<typeof GenerateNotesRequestSchema>;
export type ReleaseJob = z.infer<typeof ReleaseJobSchema>;
export type ReleaseJobQueryParams = z.infer<typeof ReleaseJobQueryParamsSchema>;
export type ActiveJobConflict = z.infer<typeof ActiveJobConflictSchema>;
export type ReleaseJobSSEEvent = z.infer<typeof ReleaseJobSSEEventSchema>;
export type ReleaseJobSSEEventType = ReleaseJobSSEEvent['type'];
