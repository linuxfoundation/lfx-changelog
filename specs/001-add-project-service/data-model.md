# Data Model: Track LFX V2 Project Service in Changelog

**Feature**: `001-add-project-service`  
**Date**: 2026-06-17

This feature uses existing Prisma models — no new tables or migrations required.

## Entity: Product

Represents the LFX V2 Project Service in the public changelog catalog.

| Field | Type | Value / Rule |
|-------|------|--------------|
| id | UUID | Auto-generated |
| name | String | `"LFX V2 Project Service"` (unique) |
| slug | String | `"lfx-v2-project-service"` (unique, lowercase-hyphenated) |
| description | String? | Service description from README |
| faIcon | String? | `"fa-duotone fa-diagram-project"` |
| iconUrl | String? | null (use FA icon) |
| isActive | Boolean | `true` |
| githubInstallationId | Int? | Set when first repo linked (optional on product) |

**Validation**:
- `name` and `slug` must be unique across all products.
- `slug` must match `^[a-z0-9]+(?:-[a-z0-9]+)*$`.

**Relationships**:
- 1:N → `ProductRepository`
- 1:N → `ChangelogEntry`
- 1:N → `UserRoleAssignment` (product-scoped)
- 0:1 → `AutoChangelogLock`, `AgentMemory`

---

## Entity: ProductRepository

Links the product to the GitHub source repository.

| Field | Type | Value / Rule |
|-------|------|--------------|
| productId | UUID | FK → Product |
| githubInstallationId | Int | From GitHub App installation |
| owner | String | `linuxfoundation` |
| name | String | `lfx-v2-project-service` |
| fullName | String | `linuxfoundation/lfx-v2-project-service` |
| htmlUrl | String | `https://github.com/linuxfoundation/lfx-v2-project-service` |
| isPrivate | Boolean | `false` |
| createdAt | DateTime | **Release sync cutoff** — only releases published on or after this timestamp are imported via manual sync (FR-009) |
| lastSyncedAt | DateTime? | Updated on webhook/sync |

**Constraints**:
- Unique on `(productId, owner, name)`.

**Relationships**:
- N:1 → `Product`
- 1:N → `GitHubRelease`

---

## Entity: GitHubRelease

Synced release metadata for admin visibility and agent context.

| Field | Type | Notes |
|-------|------|-------|
| repositoryId | UUID | FK → ProductRepository |
| githubId | Int | GitHub release ID |
| tagName | String | e.g. `v0.8.3` |
| name | String? | Release title |
| body | String? | GitHub release notes (markdown) |
| isDraft | Boolean | |
| isPrerelease | Boolean | |
| publishedAt | DateTime? | Used for sync cutoff filtering |
| authorLogin | String | |
| authorAvatarUrl | String | |

**Constraints**:
- Unique on `(repositoryId, githubId)`.

**State transitions**:
- Created/updated via webhook (`release` published/created/edited) or manual sync (post-connection only).
- Deleted via webhook (`release` deleted action).

---

## Entity: ChangelogEntry

User-facing release notes (manual or agent-generated drafts).

| Field | Type | Notes |
|-------|------|-------|
| productId | UUID | FK → Project Service product |
| title | String | |
| description | String | Markdown body |
| version | String? | e.g. `0.8.3` (derived from tag) |
| source | Enum | `manual` or `automated` |
| status | Enum | `draft` → `published` |
| publishedAt | DateTime? | Set on publish |

**Workflow**:
1. Agent or admin creates `draft`.
2. Product admin reviews and sets `published`.
3. Entry appears on public `/products/lfx-v2-project-service` changelog page.

---

## Entity: UserRoleAssignment

RBAC mapping for changelog team curation.

| Field | Type | Value / Rule |
|-------|------|--------------|
| userId | UUID | Changelog team member |
| productId | UUID | Project Service product ID |
| role | Enum | `product_admin` |

**Validation**:
- Users with `product_admin` on this product can create/edit/publish changelogs scoped to it.
- `super_admin` retains full access.

---

## Data Flow Summary

```text
[Admin creates Product]
        ↓
[GitHub App links ProductRepository]  ← createdAt = sync cutoff
        ↓
[Webhook: new release] ──→ GitHubRelease upsert ──→ AgentJob ──→ ChangelogEntry (draft)
        ↓
[Product admin publishes] ──→ Public changelog visible
```
