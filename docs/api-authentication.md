<!-- Copyright The Linux Foundation and each contributor to LFX. -->
<!-- SPDX-License-Identifier: MIT -->

# API Authentication

The LFX Changelog API supports two authentication methods: **OAuth session cookies** (browser-based) and **API keys** (programmatic access). Both methods flow through a single hybrid authentication middleware and share the same role-based authorization layer.

## Authentication Methods

### OAuth (Browser Sessions)

The default method for browser-based access. Users log in via Auth0 and receive an encrypted session cookie (`appSession`). All admin UI interactions use this method.

- **How it works:** Auth0 redirects back to the app after login, setting a session cookie
- **Where it's used:** Admin dashboard, changelog editor, all browser-based admin actions
- **No setup required:** handled automatically by the Auth0 SDK

### API Keys (Programmatic Access)

API keys allow scripts, CI/CD pipelines, and external tools to access protected endpoints without a browser session.

- **Prefix:** all keys start with `lfx_` followed by a Base64url-encoded random token
- **Storage:** only a SHA-256 hash is stored server-side — the raw key is shown once at creation and cannot be retrieved again
- **Scoping:** each key is granted specific scopes that limit which resources it can access
- **Expiration:** keys expire after a configurable period (30 to 365 days)
- **Rate limiting:** keys inherit the same rate limits as browser sessions
- **Ownership:** keys are tied to the user who created them and inherit that user's roles for authorization checks

## API Key Scopes

Each scope grants access to a specific resource and action. When creating a key, you can only request scopes your role is permitted to use.

| Scope              | Description                                           | Minimum Role  |
| ------------------ | ----------------------------------------------------- | ------------- |
| `changelogs:read`  | Read changelog entries and their details              | `editor`      |
| `changelogs:write` | Create, update, publish, and delete changelog entries | `editor`      |
| `products:read`    | Read product listings and their details               | `editor`      |
| `products:write`   | Create, update, and delete products                   | `super_admin` |

A `super_admin` can create keys with any scope. A `product_admin` or `editor` cannot create keys with `products:write` because that scope requires `super_admin`.

## Sending API Key Requests

Include your API key in one of two headers:

### Authorization Header (Recommended)

```bash
curl -X GET https://changelog.lfx.dev/api/changelogs \
  -H "Authorization: Bearer lfx_your_api_key_here"
```

### X-API-Key Header

```bash
curl -X GET https://changelog.lfx.dev/api/changelogs \
  -H "X-API-Key: lfx_your_api_key_here"
```

Both methods are equivalent. The `Authorization: Bearer` header is recommended as it follows standard conventions and works with tools like Swagger UI.

## Managing API Keys

API keys are managed through the admin UI or the API itself. API key management endpoints require OAuth authentication — you cannot use an API key to create or revoke other API keys.

### Creating a Key (UI)

1. Log in to the admin dashboard
2. Navigate to **API Keys** in the sidebar
3. Click **Create API Key**
4. Enter a name, select scopes, and choose an expiration period
5. Copy the generated key — it will not be shown again

### Creating a Key (API)

```bash
curl -X POST https://changelog.lfx.dev/api/api-keys \
  -H "Content-Type: application/json" \
  -H "Cookie: appSession=<your_session_cookie>" \
  -d '{
    "name": "CI Pipeline Key",
    "scopes": ["changelogs:read", "changelogs:write"],
    "expiresInDays": 90
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "apiKey": {
      "id": "uuid",
      "name": "CI Pipeline Key",
      "keyPrefix": "lfx_abc123ab",
      "scopes": ["changelogs:read", "changelogs:write"],
      "expiresAt": "2026-05-29T00:00:00.000Z",
      "lastUsedAt": null,
      "revokedAt": null,
      "createdAt": "2026-02-28T00:00:00.000Z"
    },
    "rawKey": "lfx_abc123...full_key_here"
  }
}
```

Save the `rawKey` immediately — it cannot be retrieved after this response.

### Listing Keys

```bash
curl https://changelog.lfx.dev/api/api-keys \
  -H "Cookie: appSession=<your_session_cookie>"
```

### Revoking a Key

```bash
curl -X DELETE https://changelog.lfx.dev/api/api-keys/<key-id> \
  -H "Cookie: appSession=<your_session_cookie>"
```

Revoked keys are immediately rejected on all subsequent requests.

## API Endpoint Categories

The API is organized into three categories based on authentication requirements:

- **Public** (`/public/api/*`) --- no authentication required. Read-only access to published changelogs, active products, and the public AI chat assistant.
- **Protected** (`/api/changelogs/*`, `/api/products/*`) --- accepts both OAuth sessions and API keys. Each endpoint declares which scope and role it requires. See the interactive [Swagger UI](https://changelog.lfx.dev/docs) for the full list of endpoints, required scopes, and request/response schemas.
- **OAuth-only** (`/api/users/*`, `/api/api-keys/*`, `/api/ai/*`, `/api/chat/*`, `/api/github/*`) --- browser session only. These endpoints reject API key authentication because they involve user management, key lifecycle, AI chat conversations, or internal integrations that should not be accessed programmatically.

## How Authorization Works

The `authorize()` middleware factory consolidates all authorization logic into a single declarative call. It replaces five separate middleware functions that existed previously.

### Authorization Flow

```text
Request
  │
  ├─ Has API key? ──► Validate key (hash, expiration, revocation)
  │                    └─► Check required scope
  │                    └─► Fall through to role checks
  │
  └─ Has session? ──► Validate OIDC session
                       └─► Look up user in DB
                       └─► Fall through to role checks
                              │
                              ├─ productRole? ──► Check user's product-scoped role
                              │                   (SUPER_ADMIN bypasses)
                              │
                              └─ role? ──► Check user's global role level
```

### Key Security Properties

- **Scope + role enforcement:** API keys must have the correct scope AND the owning user must have the required role. A key with `products:write` scope owned by an `editor` will still be rejected on `super_admin`-only routes
- **Scope minting restriction:** Users cannot create keys with scopes above their role level — an `editor` cannot create a key with `products:write` (requires `super_admin`)
- **No privilege escalation:** API key requests go through the same role checks as OAuth requests after scope validation
- **Hash-only storage:** Raw keys are never stored — only SHA-256 hashes. A database breach does not expose usable keys
- **Maximum keys:** Each user is limited to 10 active (non-revoked, non-expired) API keys

## Usage Examples

### List Published Changelogs (Public)

```bash
curl https://changelog.lfx.dev/public/api/changelogs?page=1&limit=10
```

### Create a Changelog Entry (API Key)

```bash
curl -X POST https://changelog.lfx.dev/api/changelogs \
  -H "Authorization: Bearer lfx_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New feature: Dark mode",
    "description": "Added dark mode support with system preference detection.",
    "productId": "product-uuid-here",
    "category": "feature",
    "version": "2.1.0"
  }'
```

### List Products (API Key)

```bash
curl https://changelog.lfx.dev/api/products \
  -H "X-API-Key: lfx_your_key_here"
```

### Publish a Changelog Entry (API Key)

```bash
curl -X PATCH https://changelog.lfx.dev/api/changelogs/<entry-id>/publish \
  -H "Authorization: Bearer lfx_your_key_here"
```

## Swagger UI

Interactive API documentation is available at `/docs`. The Swagger UI is configured with API key authentication — enter your key in the **Authorize** dialog using the `Bearer <key>` format.

```text
https://changelog.lfx.dev/docs
```

## Error Responses

### Authentication Errors (401)

```json
{
  "success": false,
  "error": "Authentication required"
}
```

Returned when:

- No API key or session cookie is provided
- The API key is invalid, expired, or revoked

### Authorization Errors (403)

```json
{
  "success": false,
  "error": "API key missing required scope: changelogs:write"
}
```

Returned when:

- The API key lacks the required scope
- The user's role is insufficient for the endpoint
- An API key is used on an OAuth-only endpoint
- A mutating request is made from a non-allowed origin (OAuth-only routes)

### Validation Errors (400)

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [{ "path": ["name"], "message": "Required" }]
}
```

Returned when the request body fails Zod schema validation.
