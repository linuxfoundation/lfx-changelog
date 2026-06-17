# Research: Track LFX V2 Project Service in Changelog

**Feature**: `001-add-project-service`  
**Date**: 2026-06-17

## R1: Onboarding path — admin UI vs seed data

**Decision**: Use admin UI + GitHub App flow for production; add optional dev seed entry for local/E2E parity.

**Rationale**: The spec assumes production onboarding through existing admin capabilities. Seed data accelerates local development and Playwright tests without coupling production deployment to a migration/seed run.

**Alternatives considered**:
- **Seed-only**: Rejected — production requires GitHub App installation and repository linking that cannot be fully automated in seed.
- **Admin-only (no seed)**: Viable but slows local validation; a single seed entry is low-cost.

---

## R2: Historical release exclusion (FR-009)

**Decision**: Filter manual release sync to only upsert releases with `publishedAt >= ProductRepository.createdAt`. Do not trigger automatic full sync on repository link.

**Rationale**: Current `GitHubService.syncReleasesForRepository()` fetches up to 100 releases with no date filter, which would violate FR-009 if an admin clicks "Sync" after linking a repo with ~37 existing tags. Webhook-driven sync already only receives new/edited release events and does not bulk-import history.

**Alternatives considered**:
- **Disable manual sync for this product**: Rejected — admins may need to recover missed webhook events for post-connection releases.
- **Per-product `syncFromDate` field**: Rejected — over-engineered; `ProductRepository.createdAt` is a sufficient cutoff for "tracking starts at connection."
- **Operational policy only (no code change)**: Rejected — not enforceable; an admin sync would still import history.

---

## R3: Product metadata defaults

**Decision**:

| Field | Value |
|-------|-------|
| name | LFX V2 Project Service |
| slug | `lfx-v2-project-service` |
| description | RESTful API for creating, reading, updating, and deleting projects within the LFX platform, with built-in authorization and audit capabilities. |
| faIcon | `fa-duotone fa-diagram-project` |
| isActive | `true` |

**Rationale**: Aligns with repository README branding and existing LFX product icon conventions (`fa-duotone` classes in `prisma/seed.ts`).

**Alternatives considered**:
- `fa-folder-tree`, `fa-sitemap`: Less specific to "project service API" semantics.

---

## R4: RBAC ownership (FR-008)

**Decision**: Assign `product_admin` on this product to existing LFX platform/changelog team users via `UserRoleAssignment` (super admin performs assignment in admin UI or API).

**Rationale**: Spec designates the changelog team as curators. No new roles or permissions are required — existing `product_admin` scoping per product is sufficient.

**Alternatives considered**:
- **New team-specific role**: Rejected — unnecessary schema/RBAC expansion.
- **Super-admin-only curation**: Rejected — conflicts with FR-008 and SC-004.

---

## R5: GitHub repository linkage

**Decision**: Link single repository `linuxfoundation/lfx-v2-project-service` under the Linux Foundation GitHub App installation.

**Rationale**: Spec scopes tracking to one public repo with `v{semver}` release tags. Existing `ProductRepository` model and GitHub App install URL flow (`/api/github/install-url?productId=`) support this without schema changes.

**Alternatives considered**:
- **Track helm chart repo separately**: Out of scope per spec assumptions.

---

## R6: Automated changelog generation

**Decision**: Rely on existing webhook → `ChangelogAgentService` pipeline for `release`, `push`, and merged `pull_request` events after repository link.

**Rationale**: No Project Service-specific agent logic is needed. Agent uses product-linked repos and published changelog history for tone matching.

**Alternatives considered**:
- **Custom agent prompt for Project Service**: Deferred — not required for MVP; can tune agent memory later.
