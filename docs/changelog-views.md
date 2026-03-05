<!-- Copyright The Linux Foundation and each contributor to LFX. -->
<!-- SPDX-License-Identifier: MIT -->

# Changelog Views (Unseen Tracking)

External LFX product apps (Organization Dashboard, Security, Insights, etc.) can show notification badges indicating how many new changelogs a user hasn't seen. The Changelog Views API tracks when each viewer last viewed each product's changelog and returns unseen counts.

## Key Concepts

- **Viewer** — an opaque identifier for the person viewing changelogs. For OAuth users this is their Auth0 `sub` claim; for API key consumers this is any stable identifier passed in the request (e.g., an Auth0 `sub` from the consuming app).
- **Unseen count** — the number of published changelog entries for a product that were published after the viewer's `lastViewedAt` timestamp. If the viewer has never viewed a product's changelog, all published entries are considered unseen.
- **View tracking is independent of the `users` table** — viewers are not linked to LFX Changelog user accounts. This allows any external product to track views for their own users without requiring those users to have an account in the changelog system.

## Authentication

Both endpoints require authentication with at minimum the `changelogs:read` scope.

| Auth Method | `viewerId` behavior                                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OAuth**   | Automatically resolved from the Auth0 `sub` claim in the session. Any `viewerId` in the request is **ignored**.                                   |
| **API Key** | `viewerId` is **required** in the request body (POST) or query string (GET). The consuming app is responsible for passing the correct identifier. |

The `mark-viewed` endpoint uses `changelogs:read` (not `changelogs:write`) because view-tracking is a "read receipt", not content modification. Read-only API keys should be able to track views.

## API Endpoints

### GET `/api/changelog-views/unseen`

Returns unseen changelog counts for the authenticated viewer.

**Query parameters:**

| Parameter    | Type     | Description                                                       |
| ------------ | -------- | ----------------------------------------------------------------- |
| `viewerId`   | `string` | Required for API key auth. Ignored for OAuth.                     |
| `productId`  | `uuid`   | Single product filter. Returns a single object.                   |
| `productIds` | `uuid[]` | Comma-separated UUIDs or repeated query params. Returns an array. |

If neither `productId` nor `productIds` is provided, returns counts for **all active products**.

**Response (single product — `productId` specified):**

```json
{
  "success": true,
  "data": {
    "productId": "uuid",
    "unseenCount": 3,
    "lastViewedAt": "2026-03-05T12:00:00.000Z"
  }
}
```

**Response (batch/all — `productIds` or no filter):**

```json
{
  "success": true,
  "data": [
    {
      "productId": "uuid-1",
      "unseenCount": 3,
      "lastViewedAt": "2026-03-05T12:00:00.000Z"
    },
    {
      "productId": "uuid-2",
      "unseenCount": 0,
      "lastViewedAt": null
    }
  ]
}
```

A `lastViewedAt` of `null` means the viewer has never viewed that product's changelog.

### POST `/api/changelog-views/mark-viewed`

Marks one or more products' changelogs as viewed, updating the `lastViewedAt` timestamp.

**Request body:**

| Field        | Type      | Description                                   |
| ------------ | --------- | --------------------------------------------- |
| `viewerId`   | `string?` | Required for API key auth. Ignored for OAuth. |
| `productId`  | `uuid?`   | Single product to mark as viewed.             |
| `productIds` | `uuid[]?` | Multiple products to mark as viewed.          |

At least one of `productId` or `productIds` must be provided. Both can be provided — they are merged and deduplicated.

**Response (single product):**

```json
{
  "success": true,
  "data": {
    "productId": "uuid",
    "lastViewedAt": "2026-03-05T12:34:56.789Z"
  }
}
```

**Response (batch):**

```json
{
  "success": true,
  "data": [
    { "productId": "uuid-1", "lastViewedAt": "2026-03-05T12:34:56.789Z" },
    { "productId": "uuid-2", "lastViewedAt": "2026-03-05T12:34:56.789Z" }
  ]
}
```

**Batch atomicity:** Batch mark-viewed is transactional. If any product ID is invalid (e.g., does not exist), the entire operation fails with a `404` and no view records are updated.

## Usage Examples

### Browser-based (OAuth)

No `viewerId` needed — the Auth0 session provides it automatically.

```bash
# Get unseen counts for all products
curl https://changelog.lfx.dev/api/changelog-views/unseen \
  -H "Cookie: appSession=<session_cookie>"

# Get unseen count for a specific product
curl "https://changelog.lfx.dev/api/changelog-views/unseen?productId=<uuid>" \
  -H "Cookie: appSession=<session_cookie>"

# Mark a product's changelog as viewed
curl -X POST https://changelog.lfx.dev/api/changelog-views/mark-viewed \
  -H "Cookie: appSession=<session_cookie>" \
  -H "Content-Type: application/json" \
  -d '{ "productId": "<uuid>" }'
```

### Programmatic (API Key)

API key consumers must pass `viewerId` to identify the viewer.

```bash
# Get unseen counts for a specific viewer
curl "https://changelog.lfx.dev/api/changelog-views/unseen?viewerId=auth0|abc123&productId=<uuid>" \
  -H "Authorization: Bearer lfx_your_key_here"

# Mark multiple products as viewed for a viewer
curl -X POST https://changelog.lfx.dev/api/changelog-views/mark-viewed \
  -H "Authorization: Bearer lfx_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "viewerId": "auth0|abc123",
    "productIds": ["<uuid-1>", "<uuid-2>"]
  }'
```

### Typical Integration Flow

An external LFX product (e.g., Organization Dashboard) would integrate as follows:

1. **On page load** — call `GET /api/changelog-views/unseen` with the user's Auth0 `sub` as `viewerId` to get badge counts
2. **Show badge** — display the `unseenCount` on a notification bell or changelog link
3. **When user opens changelog** — call `POST /api/changelog-views/mark-viewed` with the relevant `productId` to reset the count
4. **Badge disappears** — subsequent calls to unseen will return `0` until new changelogs are published

## Error Responses

### Missing viewerId (API key auth)

```json
{
  "success": false,
  "error": "viewerId is required for API key authentication",
  "code": "AUTHENTICATION_ERROR"
}
```

### Non-existent product

```json
{
  "success": false,
  "error": "Products not found: 00000000-0000-0000-0000-000000000000",
  "code": "NOT_FOUND"
}
```

### Validation errors

```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [{ "path": ["productId"], "message": "Invalid uuid" }]
}
```

## Database

The `changelog_views` table stores one record per viewer-product pair:

| Column           | Type        | Description                                          |
| ---------------- | ----------- | ---------------------------------------------------- |
| `id`             | `uuid`      | Primary key                                          |
| `viewer_id`      | `string`    | Opaque viewer identifier (e.g., Auth0 sub)           |
| `product_id`     | `uuid`      | FK to `products` table                               |
| `last_viewed_at` | `timestamp` | When the viewer last viewed this product's changelog |
| `created_at`     | `timestamp` | Record creation time                                 |
| `updated_at`     | `timestamp` | Last update time                                     |

**Constraints:**

- Unique index on `(viewer_id, product_id)` — one record per viewer per product
- Index on `viewer_id` for efficient lookups
- Cascade delete on `product_id` — removing a product cleans up its view records
