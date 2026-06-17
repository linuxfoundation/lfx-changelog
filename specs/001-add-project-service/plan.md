# Implementation Plan: Track LFX V2 Project Service in Changelog

**Branch**: `001-add-project-service` | **Date**: 2026-06-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-add-project-service/spec.md`

## Summary

Onboard `linuxfoundation/lfx-v2-project-service` as a new LFX Changelog product ("LFX V2 Project Service") using existing product, GitHub App, webhook, and agent pipelines. The primary engineering change is enforcing **no historical release backfill** by filtering manual sync to releases published on or after repository link time. Production onboarding is admin-driven; optional seed/E2E fixtures support local validation.

## Technical Context

**Language/Version**: TypeScript (Node.js >= 22), Angular 20  
**Primary Dependencies**: Express 5, Prisma 7, Zod 4, GitHub App API, Claude Agent SDK  
**Storage**: PostgreSQL 16 (`products`, `product_repositories`, `github_releases`, `changelog_entries`, `user_role_assignments`)  
**Testing**: Playwright E2E, API spec tests under `apps/lfx-changelog/e2e/specs/`  
**Target Platform**: LFX Changelog web app (Angular SSR + Express), deployed via Helm/ArgoCD  
**Project Type**: Turborepo monorepo — web application (`apps/lfx-changelog`, `packages/shared`, `packages/mcp-server`)  
**Performance Goals**: Webhook ACK < 1s; release visible in admin within 5 minutes (SC-003)  
**Constraints**: No schema migrations; no historical release import (FR-009); changelog team owns curation (FR-008)  
**Scale/Scope**: 1 product, 1 repository, future releases only

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Constitution ratified | ⚠️ N/A | `.specify/memory/constitution.md` is template-only; no project-specific gates defined |
| Minimal scope | ✅ Pass | Reuses existing models/APIs; one targeted sync filter change |
| Test coverage | ✅ Pass | Plan includes sync filter unit test + E2E/API validation in quickstart |
| No over-engineering | ✅ Pass | Uses `ProductRepository.createdAt` as cutoff — no new config fields |
| Security (RBAC) | ✅ Pass | Existing `SUPER_ADMIN` / `product_admin` enforcement unchanged |

**Post-design re-check**: ✅ No violations. Complexity Tracking table not required.

## Project Structure

### Documentation (this feature)

```text
specs/001-add-project-service/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 entity mapping
├── quickstart.md        # Phase 1 validation guide
├── contracts/
│   └── product-onboarding.md
└── tasks.md             # Phase 2 (/speckit-tasks — not yet created)
```

### Source Code (repository root)

```text
apps/lfx-changelog/
├── prisma/
│   └── seed.ts                          # Optional: add Project Service product
├── src/server/
│   ├── services/
│   │   └── github.service.ts            # Filter sync by repo.createdAt
│   └── controllers/
│       └── webhook.controller.ts        # No change (webhooks already event-driven)
├── e2e/
│   ├── helpers/test-data.ts             # Optional: E2E product fixture
│   └── specs/api/releases.api.spec.ts   # Test sync cutoff behavior
└── src/app/modules/admin/               # No UI changes — existing product/repo flows

packages/shared/
└── src/schemas/dto.schema.ts            # No change — CreateProductRequest unchanged
```

**Structure Decision**: Web monorepo layout unchanged. Touch server sync logic, optional seed/E2E fixtures, and ops documentation only.

## Implementation Phases

### Phase A: Enforce no historical backfill (code)

**File**: `apps/lfx-changelog/src/server/services/github.service.ts`

In `syncReleasesForRepository()`:
- After fetching releases from GitHub, filter to releases where `published_at >= repo.createdAt` (or skip releases with null `published_at` unless draft).
- Log skipped count for observability.
- Webhook `upsertReleaseFromWebhook` unchanged — only receives active events.

**Tests**:
- Add unit/integration test: repo linked at time T → sync ignores releases published before T.
- Extend `e2e/specs/api/releases.api.spec.ts` if mock GitHub layer exists.

### Phase B: Dev fixtures (optional)

**File**: `apps/lfx-changelog/prisma/seed.ts`

Add product entry matching approved metadata. Do **not** seed `ProductRepository` (requires real GitHub installation ID).

**File**: `apps/lfx-changelog/e2e/helpers/test-data.ts` (optional)

Add `e2e-project-service` fixture if E2E coverage for this product is desired.

### Phase C: Production onboarding (ops)

Execute [quickstart.md](./quickstart.md) production checklist:
1. Super admin creates product.
2. Changelog team users receive `product_admin` assignment.
3. GitHub App links `linuxfoundation/lfx-v2-project-service`.
4. Verify zero historical releases after link.
5. Confirm webhook delivery on next release.

No deployment changes required unless GitHub App lacks org repo access (ops task).

## Complexity Tracking

> Not applicable — no constitution violations.

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Research | [research.md](./research.md) | ✅ Complete |
| Data model | [data-model.md](./data-model.md) | ✅ Complete |
| Contracts | [contracts/product-onboarding.md](./contracts/product-onboarding.md) | ✅ Complete |
| Quickstart | [quickstart.md](./quickstart.md) | ✅ Complete |
| Tasks | `tasks.md` | ⏳ `/speckit-tasks` |

## Next Step

Run `/speckit-tasks` to generate actionable implementation tasks from this plan.
