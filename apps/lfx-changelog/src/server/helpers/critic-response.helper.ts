// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { z } from 'zod';

const CriticResponseSchema = z.object({
  scores: z.object({
    accuracy: z.number().min(1).max(5),
    clarity: z.number().min(1).max(5),
    tone: z.number().min(1).max(5),
    completeness: z.number().min(1).max(5),
  }),
  overall: z.number().min(1).max(5),
});

export type QualityScore = { accuracy: number; clarity: number; tone: number; completeness: number; overall: number };

/**
 * Extracts quality scores from a critic response string.
 * Handles both raw JSON and JSON wrapped in markdown code fences.
 * Returns null if the response cannot be parsed or doesn't match the schema.
 */
export function parseCriticScores(text: string): QualityScore | null {
  try {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    const raw = JSON.parse(jsonMatch[1]!.trim());
    const parseResult = CriticResponseSchema.safeParse(raw);
    if (parseResult.success) {
      const { scores, overall } = parseResult.data;
      return { ...scores, overall };
    }
    return null;
  } catch {
    return null;
  }
}
