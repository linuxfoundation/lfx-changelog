# Tasks: Track LFX V2 Project Service in Changelog

**Input**: Design documents from `/specs/001-add-project-service/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not explicitly requested in spec — implementation includes targeted E2E/API coverage where fixtures are added.

**Organization**: Tasks grouped by user story for independent implementation and validation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1, US2, US3)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm environment and design context before code changes

- [x] T001 Review design artifacts (plan.md, research.md, data-model.md, contracts/product-onboarding.md) in specs/001-add-project-service/
- [x] T002 [P] Verify GitHub App env vars (GITHUB_APP_ID, GITHUB_PRIVATE_KEY, GITHUB_WEBHOOK_SECRET) are documented in apps/lfx-changelog/.env.example for repository linking

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Enforce FR-009 — no historical release backfill on manual sync

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Filter manual release sync to releases with publishedAt >= ProductRepository.createdAt in apps/lfx-changelog/src/server/services/github.service.ts
- [x] T004 Add structured logging for skipped pre-connection release count in apps/lfx-changelog/src/server/services/github.service.ts syncReleasesForRepository()

**Checkpoint**: Manual sync no longer imports ~37 historical tags; webhooks unchanged

---

## Phase 3: User Story 1 - Public Discovery (Priority: P1) 🎯 MVP

**Goal**: LFX V2 Project Service appears in the public changelog catalog with correct metadata

**Independent Test**: Unauthenticated GET /public/api/products returns product with name "LFX V2 Project Service", slug `lfx-v2-project-service`, description, and faIcon

### Implementation for User Story 1

- [x] T005 [P] [US1] Add LFX V2 Project Service product entry (name, slug, description, faIcon) to apps/lfx-changelog/prisma/seed.ts
- [x] T006 [P] [US1] Add e2e-lfx-v2-project-service fixture to apps/lfx-changelog/e2e/helpers/test-data.ts TEST_PRODUCTS
- [x] T007 [US1] Add public API test asserting Project Service catalog fields in apps/lfx-changelog/e2e/specs/api/public-products.api.spec.ts

**Checkpoint**: Product visible on public catalog; visitors can open /products/lfx-v2-project-service (empty changelog until entries published)

---

## Phase 4: User Story 2 - Admin Configuration (Priority: P2)

**Goal**: Admins can create product, assign changelog team RBAC, link GitHub repo, and sync post-connection releases only

**Independent Test**: Super admin creates product, assigns product_admin, links linuxfoundation/lfx-v2-project-service; manual sync returns synced: 0 with no historical releases imported

### Implementation for User Story 2

- [x] T008 [P] [US2] Add product_admin role assignment for e2e-lfx-v2-project-service to apps/lfx-changelog/e2e/helpers/test-data.ts TEST_ROLE_ASSIGNMENTS
- [x] T009 [US2] Add POST /api/products test with Project Service metadata (name, slug, description, faIcon) in apps/lfx-changelog/e2e/specs/api/products.api.spec.ts
- [x] T010 [US2] Add super_admin RBAC test for POST /api/releases/sync/:productId in apps/lfx-changelog/e2e/specs/api/releases.api.spec.ts
- [x] T011 [US2] Document production onboarding steps (create product, assign changelog team product_admin, GitHub App repo link, verify zero backfill) in specs/001-add-project-service/quickstart.md Scenarios 1–3

**Checkpoint**: Admin flows documented and API-tested; production onboarding runbook ready

---

## Phase 5: User Story 3 - Automated Changelog Drafts (Priority: P3)

**Goal**: Webhook-driven release/push/PR events generate draft changelog entries for human review and publish

**Independent Test**: After repo link, a release webhook for linuxfoundation/lfx-v2-project-service creates a draft ChangelogEntry; product_admin can publish it to the public page

### Implementation for User Story 3

- [x] T012 [US3] Document webhook validation steps (release event → GitHubRelease upsert → agent draft) in specs/001-add-project-service/quickstart.md Scenario 4
- [x] T013 [US3] Document product_admin publish workflow in specs/001-add-project-service/quickstart.md Scenario 3 referencing apps/lfx-changelog/src/server/services/changelog-agent.service.ts behavior

**Checkpoint**: No code changes required — existing webhook/agent pipeline applies once US2 repo is linked

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, catalog accuracy, end-to-end validation

- [x] T014 [P] Document release sync cutoff (publishedAt >= createdAt) in docs/github-integration.md Release Syncing section
- [x] T015 [P] Update LFX product count reference in README.md Features section if seed adds 10th product
- [x] T016 Execute quickstart.md production checklist and record validation results in specs/001-add-project-service/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS** all user stories
- **US1 (Phase 3)**: Depends on Foundational — no dependency on US2/US3 for catalog visibility
- **US2 (Phase 4)**: Depends on Foundational — builds on US1 seed/fixture patterns
- **US3 (Phase 5)**: Depends on US2 repo link in production; code requires no changes
- **Polish (Phase 6)**: Depends on Phases 2–5

### User Story Dependencies

```text
Phase 2 (sync filter)
       ↓
   US1 (seed + public catalog)  ← MVP
       ↓
   US2 (RBAC + admin API + ops runbook)
       ↓
   US3 (webhook/agent validation docs)
       ↓
   Polish
```

- **US1**: Independent after Phase 2 — delivers public catalog entry (MVP)
- **US2**: Requires US1 fixtures for consistent slug/metadata; production repo link is ops
- **US3**: Requires US2 repo link in deployed environment; no additional code

### Parallel Opportunities

- **Phase 1**: T001 and T002 in parallel
- **Phase 3**: T005 and T006 in parallel (seed.ts vs test-data.ts)
- **Phase 4**: T008 parallel with T009 prep (different files)
- **Phase 6**: T014 and T015 in parallel

---

## Parallel Example: User Story 1

```bash
# Launch seed and E2E fixture tasks together:
Task T005: Add product to apps/lfx-changelog/prisma/seed.ts
Task T006: Add fixture to apps/lfx-changelog/e2e/helpers/test-data.ts

# Then sequential:
Task T007: Add public API test in apps/lfx-changelog/e2e/specs/api/public-products.api.spec.ts
```

---

## Parallel Example: User Story 2

```bash
# Launch in parallel:
Task T008: TEST_ROLE_ASSIGNMENTS in apps/lfx-changelog/e2e/helpers/test-data.ts
Task T011: quickstart.md Scenarios 1–3 documentation

# Then API tests:
Task T009: apps/lfx-changelog/e2e/specs/api/products.api.spec.ts
Task T010: apps/lfx-changelog/e2e/specs/api/releases.api.spec.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational sync filter (T003–T004) — **required even for MVP**
3. Complete Phase 3: User Story 1 (T005–T007)
4. **STOP and VALIDATE**: `curl /public/api/products` shows LFX V2 Project Service
5. Deploy/demo catalog entry; changelog entries come with US2/US3

### Incremental Delivery

1. Setup + Foundational → FR-009 enforced globally
2. US1 → Public catalog entry live (MVP)
3. US2 → Production onboarding + RBAC complete
4. US3 → Webhook/agent pipeline validated on first post-connection release
5. Polish → Docs and checklist signed off

### Suggested Task Counts

| Phase | Tasks | IDs |
|-------|-------|-----|
| Setup | 2 | T001–T002 |
| Foundational | 2 | T003–T004 |
| US1 (P1) | 3 | T005–T007 |
| US2 (P2) | 4 | T008–T011 |
| US3 (P3) | 2 | T012–T013 |
| Polish | 3 | T014–T016 |
| **Total** | **16** | |

---

## Notes

- No Prisma schema migrations required — uses existing Product, ProductRepository, GitHubRelease, ChangelogEntry, UserRoleAssignment models
- Production repo link (linuxfoundation/lfx-v2-project-service) requires GitHub App access — ops task in T011, not automatable in CI
- E2E products use `e2e-` slug prefix; production/seed uses `lfx-v2-project-service`
- Commit after each phase checkpoint
