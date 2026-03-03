// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { z } from 'zod';

import { ChangelogDocumentSchema } from './search.schema.js';

// ── Query DSL ─────────────────────────────────────────────────────────────
export const OpenSearchQueryClauseSchema = z.object({
  multi_match: z
    .object({
      query: z.string(),
      fields: z.array(z.string()),
      fuzziness: z.string(),
      type: z.string(),
    })
    .optional(),
  term: z.record(z.string(), z.string()).optional(),
});

export type OpenSearchQueryClause = z.infer<typeof OpenSearchQueryClauseSchema>;

// ── Raw response shapes from SDK ──────────────────────────────────────────
export const OpenSearchHitItemSchema = z.object({
  _source: ChangelogDocumentSchema,
  _score: z.number(),
  highlight: z.record(z.string(), z.array(z.string())).optional(),
});

export type OpenSearchHitItem = z.infer<typeof OpenSearchHitItemSchema>;

export const OpenSearchHitsResponseSchema = z.object({
  total: z.union([z.number(), z.object({ value: z.number() })]),
  hits: z.array(OpenSearchHitItemSchema),
});

export type OpenSearchHitsResponse = z.infer<typeof OpenSearchHitsResponseSchema>;

export const OpenSearchAggBucketSchema = z.object({
  key: z.string(),
  doc_count: z.number(),
  product_name: z
    .object({
      buckets: z.array(z.object({ key: z.string() })).optional(),
    })
    .optional(),
});

export type OpenSearchAggBucket = z.infer<typeof OpenSearchAggBucketSchema>;

export const OpenSearchSearchResponseSchema = z.object({
  hits: OpenSearchHitsResponseSchema,
  aggregations: z
    .object({
      products: z
        .object({
          buckets: z.array(OpenSearchAggBucketSchema).optional(),
        })
        .optional(),
    })
    .optional(),
});

export type OpenSearchSearchResponse = z.infer<typeof OpenSearchSearchResponseSchema>;

// ── Bulk indexing ─────────────────────────────────────────────────────────
export const OpenSearchBulkActionSchema = z.object({
  index: z.object({ _index: z.string(), _id: z.string() }),
});

export type OpenSearchBulkAction = z.infer<typeof OpenSearchBulkActionSchema>;

export const OpenSearchBulkResponseSchema = z.object({
  errors: z.boolean(),
  items: z.array(
    z.object({
      index: z.object({ _id: z.string(), error: z.unknown().optional() }).optional(),
      create: z.object({ _id: z.string(), error: z.unknown().optional() }).optional(),
    })
  ),
});

export type OpenSearchBulkResponse = z.infer<typeof OpenSearchBulkResponseSchema>;
