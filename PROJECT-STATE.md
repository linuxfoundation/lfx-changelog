# LFX Changelog — Current Project State

**Last updated:** 2026-02-26

---

## Completion Status

| Phase    | Status      | Description                                                                           |
| -------- | ----------- | ------------------------------------------------------------------------------------- |
| Phase 1  | DONE        | Turborepo monorepo scaffolded (Yarn 4, workspaces, turbo.json)                        |
| Phase 2  | DONE        | Angular 20 SSR app created (`--style=tailwind --ssr --zoneless --prefix=lfx`)         |
| Phase 3  | DONE        | Shared package (`@lfx-changelog/shared`) with types, enums, constants, mocks          |
| Phase 4  | DONE        | UI shared components (16 core + 6 domain) + all pages with hardcoded mock data        |
| Phase 5  | DONE        | Docker Compose for PostgreSQL                                                         |
| Phase 6  | DONE        | Prisma schema, migration ready (seed script written)                                  |
| Phase 7  | DONE        | Express server skeleton (controller/service pattern)                                  |
| Phase 8  | DONE        | Auth0 integration (`express-openid-connect`)                                          |
| Phase 9  | DONE        | RBAC middleware (super_admin / product_admin / editor)                                |
| Phase 10 | DONE        | REST API routes (public + protected)                                                  |
| Phase 11 | DONE        | Frontend wired to API — all MOCK\_ data removed, 3 Angular services                   |
| Phase 12 | DONE        | Auth wiring & app-wide CSS animation system                                           |
| Phase 13 | DONE        | Server optimization — CORS, cache, security headers, rate limiting, graceful shutdown |
| Phase 14 | DONE        | Docker (multi-stage, non-root) & CI/CD deployment for AWS ECS Fargate                 |
| Phase 15 | DONE        | GitHub integration — App install flow, product repos, aggregated activity             |
| Phase 16 | DONE        | AI changelog generation with SSE streaming                                            |
| Phase 17 | DONE        | Open source files (SPDX headers, LICENSE), CI workflow, Husky pre-commit              |
| Phase 18 | **PLANNED** | **API hardening — zod validation, UUID params, AI context limits**                    |
| Phase 19 | **PLANNED** | **Infrastructure hardening — Dockerfile HEALTHCHECK, tiered rate limits, image scan** |
| Phase 20 | **PLANNED** | **Frontend error handling — admin delete/role error states, toasts, confirmations**   |

---

## What's Built

### Monorepo Structure

```text
lfx-changelog/
├── apps/lfx-changelog/           # Angular 20 SSR app
│   ├── src/
│   │   ├── app/
│   │   │   ├── app.ts                  # Root component
│   │   │   ├── app.config.ts           # App config (zoneless, hydration, router)
│   │   │   ├── app.config.server.ts    # Server config
│   │   │   ├── app.routes.ts           # Client routes
│   │   │   ├── app.routes.server.ts    # SSR routes
│   │   │   ├── layouts/
│   │   │   │   ├── public-layout/      # Header + content
│   │   │   │   └── admin-layout/       # Sidebar + header + content
│   │   │   ├── modules/
│   │   │   │   ├── public/
│   │   │   │   │   ├── changelog-feed/      # / — Timeline feed
│   │   │   │   │   ├── product-changelog/   # /products/:slug
│   │   │   │   │   └── changelog-detail/    # /entry/:id
│   │   │   │   └── admin/
│   │   │   │       ├── admin-dashboard/     # /admin
│   │   │   │       ├── changelog-list/      # /admin/changelogs
│   │   │   │       ├── changelog-editor/    # /admin/changelogs/new | /edit
│   │   │   │       ├── product-management/  # /admin/products
│   │   │   │       └── user-management/     # /admin/users
│   │   │   └── shared/
│   │   │       ├── components/         # 22 custom Tailwind components
│   │   │       │   ├── avatar/
│   │   │       │   ├── badge/
│   │   │       │   ├── button/
│   │   │       │   ├── card/
│   │   │       │   ├── category-badge/
│   │   │       │   ├── changelog-card/
│   │   │       │   ├── dialog/
│   │   │       │   ├── dropdown-menu/
│   │   │       │   ├── empty-state/
│   │   │       │   ├── input/
│   │   │       │   ├── markdown-renderer/
│   │   │       │   ├── product-pill/
│   │   │       │   ├── select/
│   │   │       │   ├── skeleton/
│   │   │       │   ├── status-badge/
│   │   │       │   ├── tabs/
│   │   │       │   ├── textarea/
│   │   │       │   └── timeline-item/
│   │   │       └── services/          # changelog, product, user, auth, theme services
│   │   ├── environments/              # env configs
│   │   ├── server/
│   │   │   ├── server-logger.ts       # Pino logger
│   │   │   ├── controllers/           # product, changelog, user controllers
│   │   │   ├── services/              # prisma, product, changelog, user services
│   │   │   ├── routes/                # product, changelog, user, public-changelog routes
│   │   │   ├── middleware/            # auth, role, error-handler
│   │   │   ├── errors/               # BaseApiError, Auth/Authorization/NotFound errors
│   │   │   └── helpers/              # error-serializer
│   │   └── main.ts, main.server.ts
│   ├── prisma/
│   │   ├── schema.prisma              # DB models: Product, ChangelogEntry, User, UserRoleAssignment
│   │   └── seed.ts                    # Seed script (7 LFX products + sample data)
│   └── angular.json, package.json, tsconfig.json, eslint.config.js
├── packages/shared/                   # @lfx-changelog/shared
│   └── src/
│       ├── interfaces/                # Product, ChangelogEntry, User, Auth, DTO, ApiResponse
│       ├── enums/                     # ChangelogCategory, ChangelogStatus, UserRole
│       ├── constants/                 # CATEGORY_CONFIG, PRODUCTS, ROLE_HIERARCHY
│       ├── utils/                     # role.util.ts
│       ├── validators/                # changelog.validator.ts
│       └── mocks/                     # mock-products, mock-changelog-entries, mock-users
├── docker-compose.yml                 # PostgreSQL 16 Alpine
├── turbo.json
├── package.json
├── .prettierrc.js                     # LFX prettier config (printWidth: 160, singleQuote, etc.)
└── .editorconfig
```

### Tech Stack (Installed)

- Angular 20 with SSR (Express)
- Tailwind CSS v4 (CSS-first `@theme`, no config file)
- TypeScript 5.9.x (strict)
- Prisma ORM (schema defined, migration ready)
- PostgreSQL via Docker Compose
- Pino logger
- Auth0 via `express-openid-connect`
- Yarn 4 + Turborepo

### API Routes (Backend — Fully Wired to Frontend)

**Public:**

- `GET /public/api/changelogs` — Published entries (filterable, paginated)
- `GET /public/api/changelogs/:id` — Single published entry

**Products (auth required):**

- `GET /api/products` — List all
- `POST /api/products` — Create (super_admin)
- `PUT /api/products/:id` — Update (super_admin)
- `DELETE /api/products/:id` — Delete (super_admin)

**Changelogs (auth required):**

- `GET /api/changelogs` — List all including drafts (editor+)
- `POST /api/changelogs` — Create (editor+)
- `PUT /api/changelogs/:id` — Update (editor+)
- `PATCH /api/changelogs/:id/publish` — Publish (editor+)
- `DELETE /api/changelogs/:id` — Delete (product_admin+)

**Users (auth required):**

- `GET /api/users/me` — Current user
- `GET /api/users` — List all (super_admin)
- `POST /api/users/:id/roles` — Assign role
- `DELETE /api/users/:id/roles/:roleId` — Remove role

### Roles

- `super_admin` — Global admin, manages everything
- `product_admin` — Per-product admin, manages users + changelogs for specific products
- `editor` — Create/edit changelogs for assigned products

---

## What's Left (Phases 18-20)

### Phase 18: API Hardening — Input Validation & Security

- Add `zod` schema validation middleware for all mutating endpoints (changelogs, products, roles)
- Add UUID format validation on all `:id` route params (return 400 instead of querying DB with garbage)
- Limit `additionalContext` field length in AI generation endpoint
- Make AI cluster URL configurable via `AI_CLUSTER_URL` env var

### Phase 19: Infrastructure Hardening

- Add `HEALTHCHECK` instruction to Dockerfile (hit `/health` endpoint)
- Differentiate rate limits by endpoint type (public reads: 100/min, auth APIs: 60/min, AI: 5/min, login: 10/min)
- Add container image scanning (Trivy/Snyk) to CI pipeline

### Phase 20: Frontend Error Handling

- Admin product management: confirmation dialog before delete, error toast on failure
- Admin user management: error feedback for role assignment/removal
- Admin changelog list: error handling for delete operations
- Use existing `lfx-toast` and `lfx-confirm-dialog` components

---

## Recent Security Fixes Applied (Code Review)

The following fixes from the PR #1 code review have been applied directly:

1. **Non-root Dockerfile user** — Added `appuser:appgroup` with `USER appuser` directive
2. **GitHub webhook state signing** — HMAC-based CSRF protection on GitHub App callback state parameter
3. **Error serializer fix** — Corrected inverted condition that was leaking stack traces to production
4. **Pagination bounds** — Clamped page/limit params (max 100 per page) in `ChangelogService`
5. **Role enum validation** — Validated role values against `UserRole` enum before database operations

---

## See Also

- `PLAN.md` — Full implementation plan with all phases documented
