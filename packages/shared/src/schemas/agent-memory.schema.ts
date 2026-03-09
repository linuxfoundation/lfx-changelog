// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { z } from 'zod';

export const StylePreferencesSchema = z
  .object({
    headingStyle: z.string().nullable().default(null),
    bulletFormat: z.string().nullable().default(null),
    tone: z.string().nullable().default(null),
    detailLevel: z.string().nullable().default(null),
    wordCountRange: z
      .object({
        min: z.number().int(),
        max: z.number().int(),
      })
      .nullable()
      .default(null),
    customInstructions: z.string().nullable().default(null),
  })
  .openapi('StylePreferences');

export const CorrectionEntrySchema = z
  .object({
    capturedAt: z.string(),
    changelogId: z.string().uuid(),
    originalTitle: z.string(),
    publishedTitle: z.string(),
    originalDescription: z.string(),
    publishedDescription: z.string(),
    diffSummary: z.string(),
  })
  .openapi('CorrectionEntry');

export const QualityScoreEntrySchema = z
  .object({
    recordedAt: z.string(),
    jobId: z.string().uuid(),
    accuracy: z.number().min(1).max(5),
    clarity: z.number().min(1).max(5),
    tone: z.number().min(1).max(5),
    completeness: z.number().min(1).max(5),
    overall: z.number().min(1).max(5),
    wasEdited: z.boolean(),
  })
  .openapi('QualityScoreEntry');

export const AgentMemoryDataSchema = z
  .object({
    stylePreferences: StylePreferencesSchema,
    recentCorrections: z.array(CorrectionEntrySchema),
    qualityScores: z.array(QualityScoreEntrySchema),
    lastAnalyzedAt: z.string().nullable().default(null),
  })
  .openapi('AgentMemoryData');

export type StylePreferences = z.infer<typeof StylePreferencesSchema>;
export type CorrectionEntry = z.infer<typeof CorrectionEntrySchema>;
export type QualityScoreEntry = z.infer<typeof QualityScoreEntrySchema>;
export type AgentMemoryData = z.infer<typeof AgentMemoryDataSchema>;
