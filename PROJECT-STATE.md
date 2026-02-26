# LFX Changelog — Current Project State

**Last updated:** 2026-02-25

---

## Completion Status

| Phase        | Status      | Description                                                                          |
| ------------ | ----------- | ------------------------------------------------------------------------------------ |
| Phase 1      | DONE        | Turborepo monorepo scaffolded (Yarn 4, workspaces, turbo.json)                       |
| Phase 2      | DONE        | Angular 20 SSR app created (`--style=tailwind --ssr --zoneless --prefix=lfx`)        |
| Phase 3      | DONE        | Shared package (`@lfx-changelog/shared`) with types, enums, constants, mocks         |
| Phase 4      | DONE        | UI shared components (16 core + 6 domain) + all pages with hardcoded mock data       |
| Phase 5      | DONE        | Docker Compose for PostgreSQL                                                        |
| Phase 6      | DONE        | Prisma schema, migration ready (seed script written)                                 |
| Phase 7-10   | DONE        | Express server, Auth0 middleware, RBAC, all API routes (controllers/services/routes) |
| **Phase 11** | **PENDING** | **Wire frontend to API — replace mock data with actual HTTP calls**                  |

---

## What's Built

### Monorepo Structure

```
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
│   │   │       ├── mocks/             # Mock data (hardcoded)
│   │   │       └── services/          # EMPTY — needs Phase 11
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

### API Routes (Backend — Built, Not Yet Connected to Frontend)

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

## What's Left (Phase 11)

### 1. Create Angular Services (signal-based state)

The `src/app/shared/services/` directory is **empty**. Need to create:

- `changelog.service.ts` — HTTP calls to `/api/changelogs` and `/public/api/changelogs`
- `product.service.ts` — HTTP calls to `/api/products`
- `user.service.ts` — HTTP calls to `/api/users`
- `auth.service.ts` — Authentication state from SSR-injected context
- `role.service.ts` — Role management API calls

### 2. Update Pages to Use Services

All pages currently import from `shared/mocks/`. Replace with service injection + HTTP calls:

- Public pages → use public API endpoints (no auth)
- Admin pages → use protected API endpoints
- Add auth guards for admin routes

### 3. Auth UI

- Login/logout buttons in header
- User menu with profile info
- Role-based visibility in admin panel

### 4. Build & Verify

- `yarn install` + `yarn build` from root
- `docker compose up -d` for PostgreSQL
- `yarn prisma migrate dev` + `yarn prisma db seed`
- `yarn start` → verify SSR + API + auth flow

---

## Key Files to Reference (from lfx-v2-ui)

| File                                                                      | Purpose                      |
| ------------------------------------------------------------------------- | ---------------------------- |
| `~/Sites/lfx-v2-ui/apps/lfx-one/src/server/server.ts`                     | Express + SSR server pattern |
| `~/Sites/lfx-v2-ui/apps/lfx-one/src/server/middleware/auth.middleware.ts` | Auth middleware pattern      |
| `~/Sites/lfx-v2-ui/apps/lfx-one/src/app/app.config.ts`                    | Angular config pattern       |
| `~/Sites/lfx-v2-ui/apps/lfx-one/eslint.config.js`                         | ESLint config to match       |

## See Also

- `PLAN.md` — Full implementation plan with all phases documented
