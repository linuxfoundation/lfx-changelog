# Contract: Product Onboarding API

**Feature**: `001-add-project-service`  
**Base URL**: `/api` (authenticated via Auth0 session or API key)

## 1. Create Product

**POST** `/api/products`  
**Auth**: `SUPER_ADMIN`

### Request

```json
{
  "name": "LFX V2 Project Service",
  "slug": "lfx-v2-project-service",
  "description": "RESTful API for creating, reading, updating, and deleting projects within the LFX platform, with built-in authorization and audit capabilities.",
  "faIcon": "fa-duotone fa-diagram-project"
}
```

### Response `201`

```json
{
  "success": true,
  "data": {
    "id": "<uuid>",
    "name": "LFX V2 Project Service",
    "slug": "lfx-v2-project-service",
    "description": "...",
    "faIcon": "fa-duotone fa-diagram-project",
    "iconUrl": null,
    "isActive": true,
    "githubInstallationId": null,
    "createdAt": "<iso8601>",
    "updatedAt": "<iso8601>"
  }
}
```

### Errors

| Status | Condition |
|--------|-----------|
| 409 / 400 | Duplicate `name` or `slug` |
| 403 | Caller lacks `SUPER_ADMIN` |

---

## 2. Assign Product Admin

**POST** `/api/users/{userId}/roles`  
**Auth**: `SUPER_ADMIN`

### Request

```json
{
  "role": "product_admin",
  "productId": "<project-service-product-uuid>"
}
```

### Response `201`

Role assignment created for changelog team member on this product.

---

## 3. Get GitHub App Install URL

**GET** `/api/github/install-url?productId={productId}`  
**Auth**: OAuth session (admin UI)

### Response `200`

```json
{
  "success": true,
  "data": {
    "url": "https://github.com/apps/<app-slug>/installations/new?state=<signed-state>"
  }
}
```

Admin completes install, selects `linuxfoundation` org, grants access to `lfx-v2-project-service`. Callback redirects to `/admin/products/{id}?tab=repositories`.

---

## 4. Link Repository

**POST** `/api/products/{productId}/repositories`  
**Auth**: `SUPER_ADMIN`

### Request

```json
{
  "githubInstallationId": 12345678,
  "owner": "linuxfoundation",
  "name": "lfx-v2-project-service",
  "fullName": "linuxfoundation/lfx-v2-project-service",
  "htmlUrl": "https://github.com/linuxfoundation/lfx-v2-project-service",
  "description": "LFX v2 Platform Project Service",
  "isPrivate": false
}
```

### Response `201`

`ProductRepository` record created; `createdAt` establishes FR-009 sync cutoff.

---

## 5. Public Product Discovery

**GET** `/public/api/products`  
**Auth**: None

### Expected entry (when `isActive: true`)

```json
{
  "id": "<uuid>",
  "name": "LFX V2 Project Service",
  "slug": "lfx-v2-project-service",
  "description": "...",
  "faIcon": "fa-duotone fa-diagram-project"
}
```

---

## 6. Release Sync (post-connection only)

**POST** `/api/releases/sync/{productId}`  
**Auth**: `SUPER_ADMIN`

### Behavior (after code change per research R2)

- Fetches releases from GitHub API.
- Upserts only releases where `publishedAt >= ProductRepository.createdAt`.
- Returns count of synced releases.

### Response `200`

```json
{
  "success": true,
  "data": { "synced": 0 }
}
```

Expected `synced: 0` immediately after link (no post-connection releases yet).

---

## 7. Webhook Events (automatic)

**POST** `/webhooks/github`  
**Auth**: HMAC `X-Hub-Signature-256`

| Event | Trigger | Effect |
|-------|---------|--------|
| `release` | published/created/edited | Upsert `GitHubRelease`, trigger agent job |
| `release` | deleted | Delete `GitHubRelease` |
| `push` | default branch | Trigger agent job |
| `pull_request` | merged to default | Trigger agent job |

Repository must match `linuxfoundation/lfx-v2-project-service` in `ProductRepository.fullName`.
