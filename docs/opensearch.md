<!-- Copyright The Linux Foundation and each contributor to LFX. -->
<!-- SPDX-License-Identifier: MIT -->

# OpenSearch Full-Text Search

The LFX Changelog uses [OpenSearch](https://opensearch.org/) for full-text search across published changelogs and blog posts. Search supports fuzzy matching, field boosting, highlighting, and faceted filtering.

## Overview

| Feature               | Description                                                                     |
| --------------------- | ------------------------------------------------------------------------------- |
| **Full-text search**  | Multi-field search across titles, descriptions, products, versions, and more    |
| **Unified endpoint**  | Single `/public/api/search` endpoint with a `target` parameter                  |
| **Fuzzy matching**    | Tolerates 1--2 character typos (e.g., "securty" matches "security")             |
| **Field boosting**    | Title matches rank 3x higher than description matches                           |
| **Highlighting**      | Search terms are wrapped in `<mark>` tags for frontend rendering                |
| **Facets**            | Aggregated counts for filtering (product facets for changelogs, type for blogs) |
| **Graceful fallback** | App continues without search if OpenSearch is unavailable                       |

## Public Search Endpoint

### `GET /public/api/search`

No authentication required. Results are cached for 30 seconds.

### Query Parameters

| Parameter   | Type   | Default | Description                                         |
| ----------- | ------ | ------- | --------------------------------------------------- |
| `target`    | enum   | ---     | Index to search: `changelogs` or `blogs` (required) |
| `q`         | string | ---     | Search query (required)                             |
| `productId` | UUID   | ---     | Filter results to a specific product (changelogs)   |
| `type`      | string | ---     | Filter by blog type (blogs)                         |
| `page`      | int    | 1       | Page number                                         |
| `limit`     | int    | 20      | Results per page (max 100)                          |

### Example Requests

```bash
# Search changelogs
curl "https://changelog.lfx.dev/public/api/search?target=changelogs&q=security+updates&page=1&limit=10"

# Search blog posts
curl "https://changelog.lfx.dev/public/api/search?target=blogs&q=EasyCLA&type=monthly_roundup"
```

### Search Response

The response shape is the same for both targets. The `hits` array contains documents from the selected index, and `facets` contains target-specific aggregations.

```json
{
  "success": true,
  "hits": [
    {
      "id": "uuid",
      "title": "March 2026 Vulnerability Patches",
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
      { "key": "uuid", "label": "Security", "count": 45 },
      { "key": "uuid", "label": "EasyCLA", "count": 23 }
    ]
  }
}
```

**Facets by target:**

| Target       | Facet name | `key`      | `label`      |
| ------------ | ---------- | ---------- | ------------ |
| `changelogs` | `products` | Product ID | Product name |
| `blogs`      | `types`    | Blog type  | ---          |

## Search Query Design

### Per-Target Field Configuration

Each target has its own search fields, filters, and facet definitions configured via `INDEX_CONFIGS` in `search.service.ts`:

| Target       | Search Fields                                                       | Filters     |
| ------------ | ------------------------------------------------------------------- | ----------- |
| `changelogs` | `title^3`, `description`, `productName^2`, `version`                | `productId` |
| `blogs`      | `title^3`, `description`, `excerpt`, `productNames^2`, `authorName` | `type`      |

### Fuzzy Search

Uses OpenSearch's `AUTO` fuzziness, which allows:

- 1 character edit for terms 3--5 characters long
- 2 character edits for terms 6+ characters long
- No fuzziness for 1--2 character terms

This catches common typos without returning irrelevant results.

### Filtering

All queries filter to `status: 'published'` only. Additional filters are applied per target based on the query parameters.

### Sorting

Results are sorted by:

1. **Relevance score** (descending) --- most relevant first
2. **Published date** (descending) --- newest first as tiebreaker

### Highlighting

Matched terms are wrapped in `<mark>` tags:

- **Title:** 1 fragment (the full title with highlights)
- **Description:** Up to 3 fragments, 150 characters each

The frontend renders these as highlighted text spans.

## Indexes

### Changelogs Index

| Setting    | Value        | Notes                                           |
| ---------- | ------------ | ----------------------------------------------- |
| Index name | `changelogs` | `CHANGELOGS_INDEX` from `@lfx-changelog/shared` |
| Shards     | 1            | Suitable for current data volume                |
| Replicas   | 0            | Development default; production should use >= 1 |

**Document schema:**

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
  productId: string; // Product UUID (keyword, filterable)
  productName: string; // Product name (boosted 2x, multi-field)
  productSlug: string;
  productFaIcon: string | null;
}
```

### Blogs Index

| Setting    | Value             | Notes                                      |
| ---------- | ----------------- | ------------------------------------------ |
| Index name | `changelog_blogs` | `BLOGS_INDEX` from `@lfx-changelog/shared` |
| Shards     | 1                 | Suitable for current data volume           |
| Replicas   | 0                 | Development default                        |

**Document schema:**

```typescript
{
  id: string;                  // Blog post UUID
  slug: string;                // Pretty URL slug
  title: string;               // Blog title (boosted 3x)
  excerpt: string | null;      // Short excerpt
  description: string;         // Full markdown content
  type: string;                // Blog type (keyword, filterable)
  status: string;              // Always 'published' for indexed docs
  coverImageUrl: string | null;
  publishedAt: string | null;  // ISO date
  createdAt: string;           // ISO date
  authorName: string;          // Author display name
  authorAvatarUrl: string | null;
  productNames: string[];      // Associated product names (boosted 2x)
  productIds: string[];        // Associated product IDs
}
```

## Automatic Indexing

Documents are indexed automatically via fire-and-forget calls when content changes:

### Changelogs

| Action                | Effect                               |
| --------------------- | ------------------------------------ |
| Changelog published   | Document indexed in OpenSearch       |
| Changelog updated     | Document re-indexed with new content |
| Changelog unpublished | Document removed from index          |
| Changelog deleted     | Document removed from index          |

### Blog Posts

| Action                          | Effect                                    |
| ------------------------------- | ----------------------------------------- |
| Blog published                  | Document indexed in OpenSearch            |
| Blog updated                    | Document re-indexed with new content      |
| Blog unpublished                | Document removed from index               |
| Blog deleted                    | Document removed from index               |
| Blog products/changelogs linked | Document re-indexed with new associations |

Index operations are **asynchronous and non-blocking** --- if OpenSearch is temporarily unavailable, the failure is logged but doesn't affect the API response.

## Bulk Reindex

Super admins can trigger a full reindex via a single endpoint with a `target` parameter.

### Endpoint

`POST /api/opensearch/reindex?target=changelogs|blogs|all`

**Authorization:** Requires `super_admin` role and `changelogs:write` API key scope.

| `target` value | Effect                  |
| -------------- | ----------------------- |
| `changelogs`   | Reindex changelogs only |
| `blogs`        | Reindex blogs only      |
| `all`          | Reindex both (default)  |

Invalid target values return `400 Bad Request`.

### Process

1. Delete the existing index
2. Recreate the index with the current mapping
3. Fetch all published entries from the database in batches of 500
4. Build OpenSearch bulk requests and execute with `refresh: "wait_for"`
5. Return indexed count and error count per target

### Reindex Response

```json
{
  "success": true,
  "data": {
    "changelogs": { "indexed": 1250, "errors": 0 },
    "blogs": { "indexed": 42, "errors": 0 }
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

| Tool      | Auth   | Description                                                           |
| --------- | ------ | --------------------------------------------------------------------- |
| `search`  | Public | Full-text search with `target` param (`changelogs` or `blogs`)        |
| `reindex` | Admin  | Trigger reindex with `target` param (`changelogs`, `blogs`, or `all`) |

See [MCP Server](mcp-server.md) for client setup instructions.

## AI Chat Integration

The AI chat assistant uses OpenSearch to ground its responses in real data. When a user asks a question like "What changed in Security this month?", the chat's agentic loop calls the `search` tool with `target: 'changelogs'`, which queries OpenSearch and returns highlighted results for the AI to synthesize. The same tool with `target: 'blogs'` enables blog post search from the chat.

See [AI Chat](ai-chat.md) for details on the chat architecture.

## Graceful Degradation

If `OPENSEARCH_URL` is not set or OpenSearch is unreachable:

- The app starts normally without search
- `GET /public/api/search` returns `503 Service Unavailable`
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
│   └── search.service.ts         # OpenSearch client, unified search(), index/delete, bulk reindex
├── controllers/
│   └── search.controller.ts      # HTTP handler for search + reindex endpoints
└── routes/
    ├── public-search.route.ts    # GET /public/api/search
    └── opensearch.route.ts       # POST /api/opensearch/reindex

packages/shared/src/
├── schemas/
│   └── search.schema.ts         # Zod schemas: SearchQueryParams, SearchResponse, document schemas
└── constants/
    └── opensearch.constant.ts   # CHANGELOGS_INDEX, BLOGS_INDEX, BULK_BATCH_SIZE
```
