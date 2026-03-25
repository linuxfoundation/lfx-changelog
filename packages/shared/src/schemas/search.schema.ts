// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { z } from 'zod';

// ── Changelog query params (listing) ────────────────────────────────────────
export const ChangelogQueryParamsSchema = z
  .object({
    productId: z.string().uuid().optional().openapi({ description: 'Filter by product ID' }),
    productSlug: z.string().optional().openapi({ description: 'Filter by product slug' }),
    status: z.string().optional().openapi({ description: 'Filter by status (draft, published)' }),
    query: z.string().optional().openapi({ description: 'Text search keywords to filter by title or description' }),
    page: z.coerce.number().int().min(1).optional().openapi({ description: 'Page number' }),
    limit: z.coerce.number().int().min(1).max(100).optional().openapi({ description: 'Results per page (max: 100)' }),
  })
  .openapi('ChangelogQueryParams');

export type ChangelogQueryParams = z.infer<typeof ChangelogQueryParamsSchema>;

// ── Search targets ──────────────────────────────────────────────────────────
export const SearchTargetSchema = z.enum(['changelogs', 'blogs']).openapi({ description: 'Which index to search' });

export type SearchTarget = z.infer<typeof SearchTargetSchema>;

// ── Search query params ─────────────────────────────────────────────────────
export const SearchQueryParamsSchema = z
  .object({
    target: SearchTargetSchema,
    q: z.string().min(1).openapi({ description: 'Search query string' }),
    productId: z.string().uuid().optional().openapi({ description: 'Filter by product ID (changelogs)' }),
    type: z.string().optional().openapi({ description: 'Filter by blog type (blogs)' }),
    page: z.coerce.number().int().min(1).default(1).openapi({ description: 'Page number (default: 1)' }),
    limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ description: 'Results per page (default: 20, max: 100)' }),
  })
  .openapi('SearchQueryParams');

export type SearchQueryParams = z.infer<typeof SearchQueryParamsSchema>;
export type SearchQueryParamsInput = z.input<typeof SearchQueryParamsSchema>;

// ── Highlights ───────────────────────────────────────────────────────────────
export const SearchHighlightsSchema = z
  .object({
    title: z.array(z.string()).optional().openapi({ description: 'Highlighted title fragments with <mark> tags' }),
    description: z.array(z.string()).optional().openapi({ description: 'Highlighted description fragments with <mark> tags' }),
  })
  .openapi('SearchHighlights');

export type SearchHighlights = z.infer<typeof SearchHighlightsSchema>;

// ── Changelog document (OpenSearch index shape) ─────────────────────────────
export const ChangelogDocumentSchema = z
  .object({
    id: z.string().openapi({ description: 'Changelog entry ID' }),
    slug: z.string().nullable().openapi({ description: 'Changelog entry slug for pretty URLs' }),
    title: z.string().openapi({ description: 'Changelog title' }),
    description: z.string().openapi({ description: 'Changelog description (markdown)' }),
    version: z.string().nullable().openapi({ description: 'Version string' }),
    status: z.string().openapi({ description: 'Entry status' }),
    publishedAt: z.string().nullable().openapi({ description: 'ISO date when published' }),
    createdAt: z.string().openapi({ description: 'ISO date when created' }),
    productId: z.string().openapi({ description: 'Product ID' }),
    productName: z.string().openapi({ description: 'Product name' }),
    productSlug: z.string().openapi({ description: 'Product slug' }),
    productFaIcon: z.string().nullable().optional().openapi({ description: 'Product Font Awesome icon class' }),
  })
  .openapi('ChangelogDocument');

export type ChangelogDocument = z.infer<typeof ChangelogDocumentSchema>;

// ── Blog document (OpenSearch index shape) ──────────────────────────────────
export const BlogDocumentSchema = z
  .object({
    id: z.string().openapi({ description: 'Blog post ID' }),
    slug: z.string().openapi({ description: 'Blog post slug' }),
    title: z.string().openapi({ description: 'Blog post title' }),
    excerpt: z.string().nullable().openapi({ description: 'Blog post excerpt' }),
    description: z.string().openapi({ description: 'Blog post description (markdown)' }),
    type: z.string().openapi({ description: 'Blog type (monthly_roundup, product_newsletter)' }),
    status: z.string().openapi({ description: 'Blog status' }),
    coverImageUrl: z.string().nullable().openapi({ description: 'Cover image URL' }),
    publishedAt: z.string().nullable().openapi({ description: 'ISO date when published' }),
    createdAt: z.string().openapi({ description: 'ISO date when created' }),
    authorName: z.string().openapi({ description: 'Author display name' }),
    authorAvatarUrl: z.string().nullable().openapi({ description: 'Author avatar URL' }),
    productNames: z.array(z.string()).openapi({ description: 'Associated product names' }),
    productIds: z.array(z.string()).openapi({ description: 'Associated product IDs' }),
  })
  .openapi('BlogDocument');

export type BlogDocument = z.infer<typeof BlogDocumentSchema>;

// ── Search hit ──────────────────────────────────────────────────────────────
// Hits can come from any index, so the runtime type is a union of all document
// shapes plus the score/highlights envelope added by the search layer.
const SearchHitEnvelopeSchema = z.object({
  score: z.number().openapi({ description: 'Relevance score from OpenSearch' }),
  highlights: SearchHighlightsSchema.openapi({ description: 'Highlighted matching fragments' }),
});

export const ChangelogSearchHitSchema = ChangelogDocumentSchema.merge(SearchHitEnvelopeSchema).openapi('ChangelogSearchHit');
export type ChangelogSearchHit = z.infer<typeof ChangelogSearchHitSchema>;

export const BlogSearchHitSchema = BlogDocumentSchema.merge(SearchHitEnvelopeSchema).openapi('BlogSearchHit');
export type BlogSearchHit = z.infer<typeof BlogSearchHitSchema>;

export const SearchHitSchema = z.union([ChangelogSearchHitSchema, BlogSearchHitSchema]).openapi('SearchHit');
export type SearchHit = z.infer<typeof SearchHitSchema>;

// ── Facet bucket ────────────────────────────────────────────────────────────
export const FacetBucketSchema = z
  .object({
    key: z.string().openapi({ description: 'Facet key (e.g., product ID, blog type)' }),
    label: z.string().optional().openapi({ description: 'Human-readable label (e.g., product name)' }),
    count: z.number().openapi({ description: 'Number of matching entries' }),
  })
  .openapi('FacetBucket');

export type FacetBucket = z.infer<typeof FacetBucketSchema>;

// ── Full search response ─────────────────────────────────────────────────────
export const SearchResponseSchema = z
  .object({
    success: z.boolean().openapi({ description: 'Whether the request was successful' }),
    hits: z.array(SearchHitSchema).openapi({ description: 'Matching entries' }),
    total: z.number().openapi({ description: 'Total number of matching entries' }),
    page: z.number().openapi({ description: 'Current page' }),
    pageSize: z.number().openapi({ description: 'Results per page' }),
    totalPages: z.number().openapi({ description: 'Total number of pages' }),
    facets: z.record(z.string(), z.array(FacetBucketSchema)).openapi({ description: 'Faceted search results keyed by facet name' }),
  })
  .openapi('SearchResponse');

/** When called without a type argument, `SearchResponse` matches the Zod schema exactly.
 *  Pass a narrower hit type (e.g. `SearchResponse<ChangelogSearchHit>`) to get typed hits. */
export type SearchResponse<T extends SearchHit = SearchHit> = Omit<z.infer<typeof SearchResponseSchema>, 'hits'> & { hits: T[] };
