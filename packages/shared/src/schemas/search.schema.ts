// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { z } from 'zod';

// ── Changelog query params (listing) ────────────────────────────────────────
export const ChangelogQueryParamsSchema = z
  .object({
    productId: z.string().uuid().optional().openapi({ description: 'Filter by product ID' }),
    status: z.string().optional().openapi({ description: 'Filter by status (draft, published)' }),
    query: z.string().optional().openapi({ description: 'Text search keywords to filter by title or description' }),
    page: z.coerce.number().int().min(1).optional().openapi({ description: 'Page number' }),
    limit: z.coerce.number().int().min(1).max(100).optional().openapi({ description: 'Results per page (max: 100)' }),
  })
  .openapi('ChangelogQueryParams');

export type ChangelogQueryParams = z.infer<typeof ChangelogQueryParamsSchema>;

// ── Search query params ─────────────────────────────────────────────────────
export const SearchQueryParamsSchema = z
  .object({
    q: z.string().min(1).openapi({ description: 'Search query string' }),
    productId: z.string().uuid().optional().openapi({ description: 'Filter by product ID' }),
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

// ── Search hit ───────────────────────────────────────────────────────────────
export const SearchHitSchema = ChangelogDocumentSchema.extend({
  score: z.number().openapi({ description: 'Relevance score from OpenSearch' }),
  highlights: SearchHighlightsSchema.openapi({ description: 'Highlighted matching fragments' }),
}).openapi('SearchHit');

export type SearchHit = z.infer<typeof SearchHitSchema>;

// ── Product facet ────────────────────────────────────────────────────────────
export const ProductFacetSchema = z
  .object({
    productId: z.string().openapi({ description: 'Product ID' }),
    productName: z.string().openapi({ description: 'Product name' }),
    count: z.number().openapi({ description: 'Number of matching entries' }),
  })
  .openapi('ProductFacet');

export type ProductFacet = z.infer<typeof ProductFacetSchema>;

// ── Full search response ─────────────────────────────────────────────────────
export const SearchResponseSchema = z
  .object({
    success: z.boolean().openapi({ description: 'Whether the request was successful' }),
    hits: z.array(SearchHitSchema).openapi({ description: 'Matching changelog entries' }),
    total: z.number().openapi({ description: 'Total number of matching entries' }),
    page: z.number().openapi({ description: 'Current page' }),
    pageSize: z.number().openapi({ description: 'Results per page' }),
    totalPages: z.number().openapi({ description: 'Total number of pages' }),
    facets: z
      .object({
        products: z.array(ProductFacetSchema).openapi({ description: 'Product facet counts' }),
      })
      .openapi({ description: 'Faceted search results' }),
  })
  .openapi('SearchResponse');

export type SearchResponse = z.infer<typeof SearchResponseSchema>;
