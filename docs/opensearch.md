<!-- Copyright The Linux Foundation and each contributor to LFX. -->
<!-- SPDX-License-Identifier: MIT -->

# OpenSearch Full-Text Search

The LFX Changelog uses [OpenSearch](https://opensearch.org/) for full-text search across published changelog entries. Search supports fuzzy matching, field boosting, highlighting, and product faceting.

## Overview

| Feature               | Description                                                            |
| --------------------- | ---------------------------------------------------------------------- |
| **Full-text search**  | Multi-field search across titles, descriptions, products, and versions |
| **Fuzzy matching**    | Tolerates 1--2 character typos (e.g., "securty" matches "security")    |
| **Field boosting**    | Title matches rank 3x higher than description matches                  |
| **Highlighting**      | Search terms are wrapped in `<mark>` tags for frontend rendering       |
| **Product facets**    | Aggregated product counts for sidebar filter UI                        |
| **Graceful fallback** | App continues without search if OpenSearch is unavailable              |

## Public Search Endpoint

### `GET /public/api/changelogs/search`

No authentication required. Results are cached for 30 seconds.

### Query Parameters

| Parameter   | Type   | Default | Description                          |
| ----------- | ------ | ------- | ------------------------------------ |
| `q`         | string | ---     | Search query (required)              |
| `productId` | UUID   | ---     | Filter results to a specific product |
| `page`      | int    | 1       | Page number                          |
| `limit`     | int    | 20      | Results per page (max 100)           |

### Example Request

```bash
curl "https://changelog.lfx.dev/public/api/changelogs/search?q=security+updates&page=1&limit=10"
```

### Search Response

```json
{
  "success": true,
  "hits": [
    {
      "id": "uuid",
      "slug": "security-march-2026-vulnerability-patches",
      "title": "March 2026 Vulnerability Patches",
      "description": "Full markdown description...",
      "version": "3.2.1",
      "status": "published",
      "publishedAt": "2026-03-01T10:30:00Z",
      "createdAt": "2026-02-28T09:00:00Z",
      "productId": "uuid",
      "productName": "Security",
      "productSlug": "security",
      "productFaIcon": "fa-duotone fa-shield-halved",
      "score": 42.15,
      "highlights": {
        "title": ["March 2026 Vulnerability <mark>Patches</mark>"],
        "description": ["...fixed critical <mark>security</mark> vulnerability..."]
      }
    }
  ],
  "total": 150,
  "page": 1,
  "pageSize": 10,
  "totalPages": 15,
  "facets": {
    "products": [
      { "productId": "uuid", "productName": "Security", "count": 45 },
      { "productId": "uuid", "productName": "EasyCLA", "count": 23 }
    ]
  }
}
```

## Search Query Design

### Multi-Field Matching

Queries search across four fields with different weights:

| Field         | Boost | Rationale                                    |
| ------------- | ----- | -------------------------------------------- |
| `title`       | 3x    | Title matches are most relevant              |
| `productName` | 2x    | Product name matches are important for scope |
| `description` | 1x    | Content body (default weight)                |
| `version`     | 1x    | Version string matches                       |

### Fuzzy Search

Uses OpenSearch's `AUTO` fuzziness, which allows:

- 1 character edit for terms 3--5 characters long
- 2 character edits for terms 6+ characters long
- No fuzziness for 1--2 character terms

This catches common typos without returning irrelevant results.

### Filtering

All queries filter to `status: 'published'` only. An optional `productId` filter narrows results to a single product.

### Sorting

Results are sorted by:

1. **Relevance score** (descending) --- most relevant first
2. **Published date** (descending) --- newest first as tiebreaker

### Highlighting

Matched terms are wrapped in `<mark>` tags:

- **Title:** 1 fragment (the full title with highlights)
- **Description:** Up to 3 fragments, 150 characters each

The frontend renders these as highlighted text spans.

### Product Facets

Each search response includes product aggregations --- a count of matching results per product. This powers the product filter UI in the search sidebar.

## Indexing

### Index Configuration

| Setting    | Value        | Notes                                           |
| ---------- | ------------ | ----------------------------------------------- |
| Index name | `changelogs` | Constant from `@lfx-changelog/shared`           |
| Shards     | 1            | Suitable for current data volume                |
| Replicas   | 0            | Development default; production should use >= 1 |

### Document Schema

Each indexed document contains:

```typescript
{
  id: string; // Changelog entry UUID
  slug: string | null; // Pretty URL slug
  title: string; // Entry title (boosted 3x)
  description: string; // Markdown content
  version: string | null;
  status: string; // Always 'published' for indexed docs
  publishedAt: string; // ISO date
  createdAt: string; // ISO date
  productId: string; // Product UUID
  productName: string; // Product name (boosted 2x, multi-field)
  productSlug: string;
  productFaIcon: string | null;
}
```

### Automatic Indexing

Documents are indexed automatically when:

| Action                | Effect                               |
| --------------------- | ------------------------------------ |
| Changelog published   | Document indexed in OpenSearch       |
| Changelog updated     | Document re-indexed with new content |
| Changelog unpublished | Document removed from index          |
| Changelog deleted     | Document removed from index          |

Index operations are **asynchronous and non-blocking** --- if OpenSearch is temporarily unavailable, the failure is logged but doesn't affect the API response.

## Bulk Reindex

Super admins can trigger a full reindex of all published changelogs.

### Endpoint

`POST /api/opensearch/reindex`

**Authorization:** Requires `super_admin` role and `changelogs:write` API key scope.

### Process

1. Delete the existing `changelogs` index
2. Recreate the index with the current mapping
3. Fetch all published changelog entries from the database in batches of 500
4. Build OpenSearch bulk requests and execute with `refresh: "wait_for"`
5. Return indexed count and error count

### Reindex Response

```json
{
  "success": true,
  "data": {
    "indexed": 1250,
    "errors": 0
  }
}
```

### When to Reindex

- After changing the index mapping or field configuration
- If the search index becomes corrupted or out of sync
- After restoring the database from a backup

Under normal operation, reindexing is not needed --- automatic indexing keeps the search index synchronized.

## MCP Tools

Two MCP tools provide search capabilities for AI clients:

| Tool                 | Auth   | Description                                              |
| -------------------- | ------ | -------------------------------------------------------- |
| `search-changelogs`  | Public | Full-text search with pagination, product filter         |
| `reindex-changelogs` | Admin  | Trigger full reindex (requires `changelogs:write` scope) |

See [MCP Server](mcp-server.md) for client setup instructions.

## AI Chat Integration

The AI chat assistant uses OpenSearch to ground its responses in real data. When a user asks a question like "What changed in Security this month?", the chat's agentic loop calls the `search_changelogs` tool, which queries OpenSearch and returns highlighted results for the AI to synthesize.

See [AI Chat](ai-chat.md) for details on the chat architecture.

## Graceful Degradation

If `OPENSEARCH_URL` is not set or OpenSearch is unreachable:

- The app starts normally without search
- `GET /public/api/changelogs/search` returns `503 Service Unavailable`
- All other endpoints (CRUD, public feed, admin) function normally
- When OpenSearch becomes available, search automatically resumes

## Environment Variables

| Variable         | Required | Default | Description                                              |
| ---------------- | -------- | ------- | -------------------------------------------------------- |
| `OPENSEARCH_URL` | No       | ---     | OpenSearch endpoint (e.g., `https://search.example.com`) |

If not set, search features are disabled and the app operates without full-text search.

## Architecture

```text
apps/lfx-changelog/src/server/
├── services/
│   ├── opensearch.service.ts     # OpenSearch client singleton + index/delete/search
│   └── search.service.ts         # Query building, bulk indexing, response mapping
├── controllers/
│   └── search.controller.ts      # HTTP handler for search + reindex endpoints
└── routes/
    ├── public-search.route.ts    # GET /public/api/changelogs/search
    └── search.route.ts           # POST /api/opensearch/reindex

packages/shared/src/
├── schemas/
│   └── search.schema.ts         # Zod schemas for search params + response
└── constants/
    └── index.ts                  # CHANGELOGS_INDEX, BULK_BATCH_SIZE, MAX_PAGE_SIZE
```
