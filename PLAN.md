# LFX Changelog Application — Implementation Plan

## Overview

A new standalone monorepo at `~/Sites/lfx-changelog` housing an Angular 20 SSR application with an Express backend, PostgreSQL (Dockerized), Prisma ORM, Auth0 authentication, and custom Tailwind CSS components — following established patterns from `lfx-v2-ui`.

**Approach: UI-first.** We build the frontend pages with hardcoded mock data first (using the `frontend-design` skill for design variations), then wire up the backend infrastructure afterward.

---

## Tech Stack Summary

| Layer    | Technology                                                           |
| -------- | -------------------------------------------------------------------- |
| Monorepo | Turborepo + Yarn 4 workspaces                                        |
| Frontend | Angular 20 SSR (standalone components, signals, zoneless)            |
| Backend  | Express (via Angular SSR server)                                     |
| Database | PostgreSQL 16 (Docker Compose locally)                               |
| ORM      | Prisma                                                               |
| Auth     | Auth0 (`express-openid-connect`)                                     |
| UI       | Custom components with TailwindCSS 4 — CSS-first config (no PrimeNG) |
| API      | REST                                                                 |

---

## Prettier Config (from `@linuxfoundation/lfx-ui-core/prettier-config`)

Since this is a standalone repo, we inline the LFX prettier values:

```js
{
  printWidth: 160,
  singleQuote: true,
  useTabs: false,
  tabWidth: 2,
  semi: true,
  bracketSpacing: true,
  arrowParens: 'always',
  trailingComma: 'es5',
  bracketSameLine: true,
  endOfLine: 'lf',
  overrides: [
    { files: ['*.json'], options: { trailingComma: 'none' } },
    { files: '*.html', options: { parser: 'angular' } },
  ]
}
```

## ESLint Config (from `apps/lfx-one/eslint.config.js`)

Flat config (ESLint 9+) with:

- `angular-eslint` + `typescript-eslint` + `@eslint/js`
- `lfx` prefix enforcement for components/directives
- Naming conventions: camelCase vars, PascalCase types, flexible for destructured/imports
- Member ordering: decorated-field → field → constructor → public → protected → private
- No nested ternaries, explicit member accessibility, no impure pipes
- Console restricted to warn/error/info/trace only

---

## Phase 1: Monorepo Scaffolding ✅

### 1.1 Create Turborepo via CLI

```bash
cd ~/Sites
npx create-turbo@latest lfx-changelog --package-manager yarn
cd lfx-changelog
```

Remove default scaffold apps/packages (`apps/web`, `apps/docs`, `packages/ui`, `packages/eslint-config`, `packages/typescript-config`).

### 1.2 Configure Yarn 4

```bash
yarn set version stable
```

`.yarnrc.yml`: `nodeLinker: node-modules`

### 1.3 Root `package.json`

- Workspaces: `["apps/*", "packages/*"]`
- Scripts: `build`, `start`, `lint`, `watch`, `db:generate`, `db:migrate`, `db:seed`, `db:studio`, `docker:up`, `docker:down`
- Engine: `node >=22`
- Dev deps: `turbo`, `typescript 5.9.x`, `prettier`, `prettier-plugin-organize-imports`, `prettier-plugin-tailwindcss`

### 1.4 `turbo.json`

Tasks: `build` (with `^build` dep), `lint`, `start`, `watch`, `test`, `start:server`

### 1.5 `.editorconfig`

```ini
root = true
[*]
charset = utf-8
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
[*.ts]
quote_type = single
[*.md]
max_line_length = off
trim_trailing_whitespace = false
```

---

## Phase 2: Angular App with SSR ✅

### 2.1 Scaffold via Angular CLI

```bash
cd ~/Sites/lfx-changelog/apps
ng new lfx-changelog \
  --style=tailwind \
  --ssr \
  --routing \
  --skip-git \
  --skip-tests \
  --package-manager=yarn \
  --prefix=lfx \
  --zoneless \
  --file-name-style-guide=2016 \
  --skip-install
```

Key flags:

- `--style=tailwind` — Angular 20 first-class Tailwind v4 support (auto-configures PostCSS + imports)
- `--ssr` — Server-Side Rendering with Express
- `--skip-tests` — Skip generation of `.spec.ts` test files
- `--zoneless` — No zone.js (matches lfx-v2-ui's `provideZonelessChangeDetection()`)
- `--file-name-style-guide=2016` — Keep `app.component.ts` convention to match lfx-v2-ui
- `--skip-install` — Monorepo handles installation via Yarn workspaces

### 2.2 Configure `angular.json`

- Builder: `@angular-devkit/build-angular:application`
- Output mode: `server`
- SSR entry: `src/server/server.ts`
- Build configs: `production`, `development`, `local`

### 2.3 Install dependencies

**Core:** `@angular/*@^20`, `@angular/ssr`, `@angular/cdk`, `express`, `compression`, `pino`, `pino-http`, `marked`, `date-fns`, `dotenv`, `rxjs`

**Dev:** `pino-pretty`, `@types/express`, `@types/compression`, `angular-eslint@21`, `@eslint/js@^9`, `eslint@^9`, `typescript-eslint@^8`, `prettier-plugin-organize-imports`, `prettier-plugin-tailwindcss`

**Later (Phase 7+):** `express-openid-connect`, `@prisma/client`, `prisma`

> Note: `tailwindcss`, `@tailwindcss/postcss`, and `postcss` are auto-installed by `--style=tailwind`. No `autoprefixer` needed (Tailwind v4 handles it internally).

### 2.4 TypeScript config

Strict mode, ES2022 target, bundler resolution, path aliases:

- `@app/*`, `@shared/*`, `@components/*`, `@services/*`, `@modules/*`, `@environments/*`
- `@lfx-changelog/shared` → `../../packages/shared/src`

### 2.5 Tailwind CSS v4 (CSS-first, no config file)

Angular's `--style=tailwind` flag auto-generates:

- `.postcssrc.json` with `@tailwindcss/postcss` plugin
- `src/styles.css` with `@import "tailwindcss";`

We customize theme via **CSS `@theme` block** (no `tailwind.config.js`):

`src/styles.css`:

```css
@import 'tailwindcss';
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap');

@theme {
  --font-sans: 'Open Sans', sans-serif;
  --font-inter: 'Inter', sans-serif;

  /* LFX brand colors */
  --color-brand-50: #eff6ff;
  --color-brand-100: #dbeafe;
  --color-brand-500: #3b82f6;
  --color-brand-600: #2563eb;
  --color-brand-700: #1d4ed8;

  /* Semantic colors for changelog categories */
  --color-bug-fix: #ef4444;
  --color-new-feature: #22c55e;
  --color-improvement: #3b82f6;
  --color-breaking-change: #f97316;

  /* Status colors */
  --color-draft: #eab308;
  --color-published: #22c55e;
}
```

Component styles use `.css` files (not `.scss`) — Tailwind v4's CSS-first approach makes SCSS unnecessary.

### 2.6 ESLint config (`eslint.config.js`)

Copy the full flat config from `lfx-v2-ui/apps/lfx-one/eslint.config.js` with `lfx` prefix rules.

### 2.7 Prettier config (`.prettierrc.js`)

Inline the LFX prettier config values (documented above).

---

## Phase 3: Shared Package (`packages/shared`) ✅

### Structure

```text
packages/shared/src/
├── interfaces/    → product, changelog-entry, user, auth, api-response
├── enums/         → ChangelogCategory, ChangelogStatus, UserRole
├── constants/     → product slugs, category labels/colors, role hierarchy
├── utils/         → shared helpers
├── validators/    → input validation
└── index.ts       → re-exports
```

### Key Types

**Enums:**

- `ChangelogCategory`: `bug_fix`, `new_feature`, `improvement`, `breaking_change`
- `ChangelogStatus`: `draft`, `published`
- `UserRole`: `super_admin`, `product_admin`, `editor`

**Interfaces:**

- `Product` — id, name, slug, description, iconUrl, timestamps
- `ChangelogEntry` — id, productId, title, description (markdown), version, category, status, publishedAt, createdBy, timestamps
- `User` — id, auth0Id, email, name, avatarUrl, timestamps, roles
- `UserRoleAssignment` — id, userId, productId (nullable for super_admin), role
- `AuthContext` — authenticated, user, dbUser
- Request/Response DTOs: `CreateChangelogEntryRequest`, `UpdateChangelogEntryRequest`, `AssignRoleRequest`

**Constants:**

- `CATEGORY_CONFIG` — maps each category to label, color, icon for UI rendering
- `PRODUCTS` — default LFX product list for seeding/mocking
- `ROLE_HIERARCHY` — numeric levels for role comparison

### Build

Pure TypeScript via `tsc`, exports via package.json `exports` field.

---

## Phase 4: UI-First — Shared Components (Custom Tailwind) ✅

> **Use the `frontend-design` skill for page-level designs.** Build shared component wrappers first, then compose pages from them.

### 4.1 Shared Component Library (`src/app/shared/components/`)

All components follow Angular 20 best practices (per [angular.dev](https://angular.dev) docs):

- **Standalone** (no NgModules) — the default in Angular 20
- **Signal-based inputs/outputs** — `input()`, `input.required()`, `output()`, `model()` — NOT `@Input()`/`@Output()` decorators
- **Signal-based computed state** — `computed()` — NOT getters
- **Zoneless compatible** — no zone.js dependency (via `--zoneless` flag)
- **CSS files** (not SCSS) — Tailwind v4 CSS-first approach
- **All styling via Tailwind utility classes** — no PrimeNG, no component libraries
- **File naming:** 2016 convention (`button.component.ts`, `button.component.html`, `button.component.css`)

#### Core UI Wrapper Components

| Component            | Purpose                      | Key Inputs                                                                          |
| -------------------- | ---------------------------- | ----------------------------------------------------------------------------------- |
| `lfx-button`         | Button wrapper with variants | `variant: 'primary'\|'secondary'\|'ghost'\|'danger'`, `size`, `loading`, `disabled` |
| `lfx-badge`          | Colored badge/pill           | `label`, `color`, `size`                                                            |
| `lfx-card`           | Content card wrapper         | `padding`, `hoverable`                                                              |
| `lfx-input`          | Text input wrapper           | `label`, `placeholder`, `error`, `type`                                             |
| `lfx-textarea`       | Textarea wrapper             | `label`, `rows`, `error`                                                            |
| `lfx-select`         | Dropdown select wrapper      | `label`, `options`, `error`                                                         |
| `lfx-dialog`         | Modal dialog                 | `visible` (model), `title`, `size`                                                  |
| `lfx-avatar`         | User avatar with fallback    | `src`, `name`, `size`                                                               |
| `lfx-empty-state`    | Empty state placeholder      | `icon`, `title`, `description`                                                      |
| `lfx-skeleton`       | Loading skeleton             | `width`, `height`, `variant: 'text'\|'circle'\|'rect'`                              |
| `lfx-data-table`     | Table wrapper                | `columns`, `data`, `loading`                                                        |
| `lfx-pagination`     | Pagination controls          | `total`, `page`, `limit`                                                            |
| `lfx-toast`          | Toast notification service   | via service injection                                                               |
| `lfx-confirm-dialog` | Confirmation modal           | via service injection                                                               |
| `lfx-tabs`           | Tab navigation               | `tabs` array, `activeTab` (model)                                                   |
| `lfx-dropdown-menu`  | Context/action menu          | `items`, `trigger` template                                                         |

#### Domain-Specific Components

| Component               | Purpose                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `lfx-changelog-card`    | Renders a single changelog entry (title, category badge, date, product, preview)                    |
| `lfx-category-badge`    | Maps ChangelogCategory to colored badge (bug=red, feature=green, improvement=blue, breaking=orange) |
| `lfx-status-badge`      | Draft (yellow) / Published (green) badge                                                            |
| `lfx-product-pill`      | Product name pill with optional icon                                                                |
| `lfx-markdown-renderer` | Renders markdown to HTML (using `marked`)                                                           |
| `lfx-timeline-item`     | Timeline entry with connecting line, date marker, and content slot                                  |

### 4.2 UI Pages (via `frontend-design` skill, hardcoded data)

Build these pages with mock data to iterate on design:

#### Public Pages

1. **Changelog Feed** (`/`) — Unified timeline of all published changelogs, product filter chips, category filter, timeline layout
2. **Product Changelog** (`/products/:slug`) — Filtered to one product, same timeline layout with product header
3. **Changelog Detail** (`/entry/:id`) — Full markdown-rendered entry with metadata sidebar

#### Admin Pages

1. **Admin Dashboard** (`/admin`) — Overview cards (total entries, drafts, published counts per product), recent activity
2. **Changelog List** (`/admin/changelogs`) — Data table with filters (product, status, category), bulk actions
3. **Changelog Editor** (`/admin/changelogs/new` and `/edit`) — Form with markdown textarea + live preview, product/category/version selectors
4. **Product Management** (`/admin/products`) — CRUD table for products
5. **User Management** (`/admin/users`) — User list with role assignments per product

#### Layouts

- **Public Layout** — Clean header with LFX branding, product nav, content area
- **Admin Layout** — Sidebar navigation + header with user menu + content area

### 4.3 Mock Data

Create `src/app/shared/mocks/` with hardcoded data arrays matching the shared interfaces:

- `mock-products.ts` — 7 LFX products
- `mock-changelog-entries.ts` — 15-20 sample entries across products, mix of draft/published, various categories
- `mock-users.ts` — 5-6 sample users with different roles

---

## Phase 5: Docker Compose for PostgreSQL ✅

**File:** `docker-compose.yml` (root)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: lfx-changelog-db
    ports:
      - '5432:5432'
    environment:
      POSTGRES_USER: changelog
      POSTGRES_PASSWORD: changelog_dev
      POSTGRES_DB: lfx_changelog
    volumes:
      - postgres_data:/var/lib/postgresql/data
volumes:
  postgres_data:
```

---

## Phase 6: Prisma Setup ✅

### 6.1 Initialize via CLI

```bash
cd apps/lfx-changelog
npx prisma init --datasource-provider postgresql
```

### 6.2 Schema (`prisma/schema.prisma`)

| Model                | Key Fields                                                                                                                                        | Relations                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `Product`            | id (uuid), name (unique), slug (unique), description?, iconUrl?, timestamps                                                                       | → ChangelogEntry[], UserRoleAssignment[]          |
| `ChangelogEntry`     | id (uuid), productId (FK), title, description, version?, category (enum), status (enum, default: draft), publishedAt?, createdBy (FK), timestamps | → Product, User                                   |
| `User`               | id (uuid), auth0Id (unique), email (unique), name, avatarUrl?, timestamps                                                                         | → ChangelogEntry[], UserRoleAssignment[]          |
| `UserRoleAssignment` | id (uuid), userId (FK), productId? (FK, null=global), role (enum), createdAt                                                                      | → User, Product?; unique(userId, productId, role) |

Indexes: productId + status + publishedAt on changelog_entries; userId + productId on user_roles

### 6.3 Migration & Seed

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

Seed data: 7 LFX products + sample users/entries

---

## Phase 7: Express Server ✅

### Directory structure (controller-service pattern from lfx-v2-ui)

```text
src/server/
├── server.ts                  # Main Express + Angular SSR
├── server-logger.ts           # Pino logger
├── controllers/               # product, changelog, user
├── services/                  # prisma (singleton), product, changelog, user
├── routes/                    # product, changelog, user, public-changelog
├── middleware/                # auth, role, error-handler
├── errors/                    # BaseApiError, AuthorizationError, etc.
└── helpers/                   # error-serializer
```

### Middleware order

1. Compression → 2. Body parsers → 3. Static files → 4. Health → 5. Pino logger → 6. OIDC → 7. Login route → 8. Auth middleware → 9. Public API → 10. Protected API → 11. API error handler → 12. SSR catch-all → 13. Global error handler

---

## Phase 8: Auth0 Integration ✅

- `express-openid-connect` with `authRequired: false`
- Custom `/login` route with returnTo
- User sync on login: find-or-create in `users` table by `auth0Id`
- Auth context passed to Angular SSR via providers

---

## Phase 9: Role-Based Access Control ✅

- Hierarchy: `super_admin (3) > product_admin (2) > editor (1)`
- `requireRole(minimumRole)` middleware checks user roles from DB
- Super admin bypasses all checks
- Product-scoped routes check role for specific product
- Express `Request` augmented with `dbUser` property

---

## Phase 10: REST API Routes ✅

### Public (no auth)

| Method | Path                         | Description                               |
| ------ | ---------------------------- | ----------------------------------------- |
| GET    | `/public/api/changelogs`     | Published entries (filterable, paginated) |
| GET    | `/public/api/changelogs/:id` | Single published entry                    |

### Products (auth required)

| GET | `/api/products` | any | List all |
| POST | `/api/products` | super_admin | Create |
| PUT | `/api/products/:id` | super_admin | Update |
| DELETE | `/api/products/:id` | super_admin | Delete |

### Changelogs (auth required)

| POST | `/api/changelogs` | editor+ | Create |
| PUT | `/api/changelogs/:id` | editor+ | Update |
| PATCH | `/api/changelogs/:id/publish` | editor+ | Publish |
| DELETE | `/api/changelogs/:id` | product_admin+ | Delete |

### Users (auth required)

| GET | `/api/users/me` | any | Current user |
| GET | `/api/users` | super_admin | List all |
| POST | `/api/users/:id/roles` | super_admin/product_admin | Assign role |
| DELETE | `/api/users/:id/roles/:roleId` | super_admin/product_admin | Remove role |

---

## Phase 11: Wire Up Frontend to API ✅

Replace mock data with actual API calls in Angular services. Each service uses signals for state:

- `ChangelogService` — signal-based state, HTTP calls to `/api/changelogs` and `/public/api/changelogs`
- `ProductService` — signal-based state, HTTP calls to `/api/products` and `/public/api/products`
- `UserService` — signal-based state, HTTP calls to `/api/users`
- Public/admin API split: public endpoints at `/public/api/*` (no auth), protected at `/api/*`
- All `MOCK_` data removed from components

---

## Phase 12: Auth Wiring & Animation System ✅

- Auth0 login/logout flow wired to UI (header user menu, login button)
- App-wide CSS animation system using Tailwind tokens (`--animate-*` in `@theme` block)
- Global `@keyframes` in `styles.css`, orchestration in component CSS
- Available tokens: `fade-in`, `fade-in-up`, `slide-in-left`, `slide-in-right`, `scale-in-up`, `rise-in`, `shimmer-in`

---

## Phase 13: Server Optimization ✅

- CORS configuration
- Cache headers (static assets, API responses)
- Security headers (Helmet-style)
- Rate limiting middleware
- Graceful shutdown handling

---

## Phase 14: Docker & CI/CD Deployment ✅

- Production `Dockerfile` (multi-stage, Alpine-based, non-root user)
- CI/CD deployment pipeline for AWS ECS Fargate
- Docker Compose for local development (PostgreSQL)

---

## Phase 15: GitHub Integration ✅

- GitHub App install flow with signed state (HMAC CSRF protection)
- Product detail page with repository management
- Aggregated GitHub activity display
- Webhook callback controller with signature verification

---

## Phase 16: AI Changelog Generation ✅

- AI-powered changelog generation endpoint with SSE streaming
- Integration with AI cluster for content generation
- Latest changelogs panel in product overview
- Expand/collapse functionality for product entries

---

## Phase 17: Open Source & Quality ✅

- SPDX license headers (`MIT`) on all source files
- Open source documentation (LICENSE, CONTRIBUTING, etc.)
- GitHub Actions CI workflow
- Husky pre-commit hook (format, lint, build checks)

---

## Phase 18: API Hardening — Input Validation & Security (PLANNED)

### 18.1 Request Body Validation (zod)

Add a schema validation layer using `zod` for all mutating API endpoints:

- `POST /api/changelogs` — validate title (required, max length), description (required), productId (UUID), version (semver pattern), status (enum)
- `PUT /api/changelogs/:id` — same fields, all optional
- `POST /api/products` — validate name (required, unique), slug (required, kebab-case), description (optional, max length)
- `PUT /api/products/:id` — same fields, all optional
- `POST /api/users/:id/roles` — validate role (enum), productId (UUID or null)

Create reusable `validateBody(schema)` Express middleware that returns 400 with structured errors on validation failure.

### 18.2 UUID Format Validation on Route Params

Add `validateUUID` middleware for all `:id` and `:roleId` route parameters. Return 400 with a clear error message if the param is not a valid UUID v4 — prevents unnecessary database queries with malformed IDs.

### 18.3 Limit AI `additionalContext` Length

Add a character limit (e.g., 5,000 chars) to the `additionalContext` field in the AI changelog generation endpoint to prevent abuse and excessive token consumption.

### 18.4 Configurable AI Cluster URL

Move the hardcoded AI cluster URL to an environment variable (`AI_CLUSTER_URL`). Add validation on startup to warn if not configured.

---

## Phase 19: Infrastructure Hardening (PLANNED)

### 19.1 Add HEALTHCHECK to Dockerfile

Add a Docker `HEALTHCHECK` instruction that hits the `/health` endpoint:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1
```

### 19.2 Differentiate Rate Limits by Endpoint Type

Replace the current blanket rate limiter with tiered limits:

| Endpoint Type       | Limit       |
| ------------------- | ----------- |
| Public read APIs    | 100 req/min |
| Auth-protected APIs | 60 req/min  |
| AI generation       | 5 req/min   |
| Login/auth          | 10 req/min  |

### 19.3 Add Container Image Scanning to CI

Add a Trivy or Snyk container image scanning step to the GitHub Actions CI workflow. Fail the build on critical/high vulnerabilities.

---

## Phase 20: Frontend Error Handling (PLANNED)

### 20.1 Admin Component Error States

Add proper error handling UI for destructive operations in admin components:

- **Product Management** — confirmation dialog before delete, error toast on failure, loading state during operation
- **User Management** — error feedback for role assignment/removal failures, optimistic UI with rollback on error
- **Changelog List** — error handling for bulk operations, delete confirmation

Use the existing `lfx-toast` and `lfx-confirm-dialog` components for consistent UX.

---

## Reference Files (from lfx-v2-ui)

| File                                                                      | Use For                                         |
| ------------------------------------------------------------------------- | ----------------------------------------------- |
| `~/Sites/lfx-v2-ui/apps/lfx-one/src/server/server.ts`                     | Express + SSR server setup, middleware ordering |
| `~/Sites/lfx-v2-ui/apps/lfx-one/src/server/middleware/auth.middleware.ts` | Route classification, auth enforcement          |
| `~/Sites/lfx-v2-ui/apps/lfx-one/src/server/routes/projects.route.ts`      | Router → Controller → Service pattern           |
| `~/Sites/lfx-v2-ui/apps/lfx-one/src/app/app.config.ts`                    | Angular config (zoneless, hydration, providers) |
| `~/Sites/lfx-v2-ui/apps/lfx-one/angular.json`                             | Angular build configuration                     |
| `~/Sites/lfx-v2-ui/apps/lfx-one/eslint.config.js`                         | ESLint flat config with Angular rules           |
| `~/Sites/lfx-v2-ui/packages/shared/package.json`                          | Shared package exports structure                |
| `~/Sites/lfx-v2-ui/turbo.json`                                            | Turborepo task configuration                    |

---

## Implementation Order

| Step | Phase                                                                       | Depends On   | Status  |
| ---- | --------------------------------------------------------------------------- | ------------ | ------- |
| 1    | Phase 1 — Monorepo scaffold                                                 | —            | ✅ DONE |
| 2    | Phase 2 — Angular app (ng new --ssr) + config                               | Phase 1      | ✅ DONE |
| 3    | Phase 3 — Shared package (types, enums, constants, mocks)                   | Phase 1      | ✅ DONE |
| 4    | Phase 4 — UI shared components + pages (hardcoded, `frontend-design` skill) | Phase 2 + 3  | ✅ DONE |
| 5    | Phase 5 — Docker Compose for PostgreSQL                                     | Phase 1      | ✅ DONE |
| 6    | Phase 6 — Prisma schema, migration, seed                                    | Phase 2 + 5  | ✅ DONE |
| 7    | Phase 7 — Express server skeleton                                           | Phase 2 + 3  | ✅ DONE |
| 8    | Phase 8 — Auth0 integration                                                 | Phase 7      | ✅ DONE |
| 9    | Phase 9 — RBAC middleware                                                   | Phase 8      | ✅ DONE |
| 10   | Phase 10 — REST API routes                                                  | Phase 6 + 9  | ✅ DONE |
| 11   | Phase 11 — Wire frontend to API                                             | Phase 4 + 10 | ✅ DONE |
| 12   | Phase 12 — Auth wiring & animation system                                   | Phase 11     | ✅ DONE |
| 13   | Phase 13 — Server optimization                                              | Phase 11     | ✅ DONE |
| 14   | Phase 14 — Docker & CI/CD deployment                                        | Phase 13     | ✅ DONE |
| 15   | Phase 15 — GitHub integration                                               | Phase 11     | ✅ DONE |
| 16   | Phase 16 — AI changelog generation                                          | Phase 15     | ✅ DONE |
| 17   | Phase 17 — Open source & quality                                            | Phase 14     | ✅ DONE |
| 18   | Phase 18 — API hardening (validation, security)                             | Phase 17     | PLANNED |
| 19   | Phase 19 — Infrastructure hardening                                         | Phase 17     | PLANNED |
| 20   | Phase 20 — Frontend error handling                                          | Phase 17     | PLANNED |

---

## Execution Strategy: Agent Team

Use a team of agents to parallelize work:

1. **Lead** — Orchestrates tasks, handles Phase 1 scaffold, coordinates
2. **Shared Agent** — Phase 3 (shared package types/enums/constants/mocks)
3. **UI Agent** — Phase 4 (shared components + pages via `frontend-design` skill, hardcoded data)
4. **Infra Agent** — Phase 5-6 (Docker, Prisma)
5. **Backend Agent** — Phase 7-10 (Express server, Auth0, RBAC, API routes)

Phases 1-3 run first (sequentially by lead + shared agent in parallel).
Then Phase 4 (UI) and Phase 5-6 (infra) run in parallel.
Then Phase 7-10 (backend) once infra is ready.
Finally Phase 11 (wire up) once both UI and backend are done.

---

## Verification

1. **Build:** `yarn build` → shared compiles → Angular builds with SSR
2. **Dev server:** `yarn start` → `http://localhost:4200` serves hardcoded UI pages
3. **Database:** `docker compose up -d` → `npx prisma studio` → verify tables and seed data
4. **Server:** Visit `http://localhost:4000/health` → OK
5. **Auth:** `/login` → Auth0 flow → callback
6. **API:** `curl /public/api/changelogs` → published entries; `/api/changelogs` (authed) → all entries
7. **RBAC:** Operations with different roles → proper 403 responses
8. **SSR:** View source → server-rendered HTML
9. **E2E:** Navigate routes, create/edit/publish changelog, manage users/roles
