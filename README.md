# LFX Changelog

A centralized changelog platform for [LFX](https://lfx.linuxfoundation.org/) products. Provides a unified, public-facing timeline of product updates and an admin interface for teams to draft, review, and publish release notes with AI-assisted generation.

## Features

- **Public changelog feed** --- filterable timeline of published entries across all LFX products
- **Per-product views** --- dedicated changelog pages for each of the 9 LFX products
- **Admin dashboard** --- overview of drafts, published entries, and recent activity
- **Changelog editor** --- Markdown-based editor with live preview and category tagging
- **AI-powered generation** --- generate changelog entries from GitHub activity via SSE streaming
- **GitHub integration** --- connect GitHub App installations to products for repository tracking
- **Role-based access** --- super admin, product admin, and editor roles with per-product scoping
- **Auth0 authentication** --- secure login via OpenID Connect
- **Dark mode** --- light/dark dual-theme with system preference detection
- **Server-side rendering** --- Angular SSR for fast initial loads and SEO
- **MCP server** --- AI tool integration via the Model Context Protocol (Claude Desktop, Cursor, etc.)
- **E2E test suite** --- Playwright tests covering public pages, admin flows, RBAC, and API endpoints

## Tech Stack

| Layer       | Technology                                            |
| ----------- | ----------------------------------------------------- |
| Monorepo    | Turborepo + Yarn 4 workspaces                         |
| Frontend    | Angular 20 (standalone components, signals, zoneless) |
| Backend     | Express 5 (via Angular SSR server)                    |
| Database    | PostgreSQL 16                                         |
| ORM         | Prisma 7 with driver adapter                          |
| Validation  | Zod 4 + OpenAPI 3.1 (Swagger UI at `/docs`)           |
| Auth        | Auth0 (`express-openid-connect`)                      |
| Styling     | Tailwind CSS 4 (CSS-first config, custom components)  |
| Testing     | Playwright (E2E, API)                                 |
| Integration | MCP SDK 1.x (Model Context Protocol)                  |
| CI/CD       | GitHub Actions, ArgoCD, Helm, GHCR                    |

## Prerequisites

- **Node.js** >= 22
- **Yarn** 4.12.0 (managed via Corepack)
- **Docker** and **Docker Compose** (for PostgreSQL)

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/linuxfoundation/lfx-changelog.git
cd lfx-changelog
corepack enable
yarn install
```

### 2. Set up environment variables

```bash
cp apps/lfx-changelog/.env.example apps/lfx-changelog/.env
```

Edit `apps/lfx-changelog/.env` with your values. See the [Environment Variables](#environment-variables) section below for details.

### 3. Start the database

```bash
yarn docker:up
```

### 4. Run database migrations and seed

```bash
yarn db:generate
yarn db:migrate
yarn db:seed
```

### 5. Start the dev server

```bash
yarn start
```

The app runs at `http://localhost:4204`

## Environment Variables

The server supports two ways to configure the database connection: a single `DATABASE_URL` connection string, or individual `DB_*` variables (which the server assembles at runtime via `buildConnectionString`). Provide one or the other.

| Variable                | Required | Description                                                                                              |
| ----------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | Yes\*    | PostgreSQL connection string (e.g., `postgresql://changelog:changelog_dev@localhost:5432/lfx_changelog`) |
| `DB_HOST`               | Yes\*    | Database host (e.g., `localhost`)                                                                        |
| `DB_PORT`               | No       | Database port (default: `5432`)                                                                          |
| `DB_NAME`               | Yes\*    | Database name (e.g., `lfx_changelog`)                                                                    |
| `DB_USER`               | Yes\*    | Database user (e.g., `changelog`)                                                                        |
| `DB_PASSWORD`           | Yes\*    | Database password                                                                                        |
| `AUTH0_CLIENT_ID`       | Yes      | Auth0 application client ID                                                                              |
| `AUTH0_CLIENT_SECRET`   | Yes      | Auth0 application client secret                                                                          |
| `AUTH0_ISSUER_BASE_URL` | Yes      | Auth0 tenant URL (e.g., `https://your-tenant.auth0.com`)                                                 |
| `AUTH0_SECRET`          | Yes      | Session encryption secret (min 32 characters)                                                            |
| `BASE_URL`              | Yes      | Application base URL (e.g., `http://localhost:4204`)                                                     |
| `GITHUB_APP_ID`         | No       | GitHub App ID for repository integration                                                                 |
| `GITHUB_PRIVATE_KEY`    | No       | GitHub App RSA private key                                                                               |
| `LITELLM_API_KEY`       | No       | API key for AI changelog generation                                                                      |
| `AI_API_URL`            | No       | AI service endpoint URL                                                                                  |
| `NODE_ENV`              | No       | `development` or `production` (default: `development`)                                                   |
| `PORT`                  | No       | Server port (default: `4000`)                                                                            |
| `LOG_LEVEL`             | No       | Logging level: `debug`, `info`, `warn`, `error` (default: `info`)                                        |

\*Provide either `DATABASE_URL` **or** the `DB_HOST`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` group.

## Scripts

### Root (monorepo-level)

| Script                  | Description                         |
| ----------------------- | ----------------------------------- |
| `yarn build`            | Build all packages (shared + app)   |
| `yarn start`            | Start the SSR server                |
| `yarn lint`             | Run ESLint across all packages      |
| `yarn format`           | Format all files with Prettier      |
| `yarn format:check`     | Check formatting without writing    |
| `yarn markdownlint`     | Lint markdown files                 |
| `yarn markdownlint:fix` | Auto-fix markdown lint issues       |
| `yarn docker:up`        | Start PostgreSQL via Docker Compose |
| `yarn docker:down`      | Stop PostgreSQL                     |
| `yarn db:generate`      | Generate Prisma client              |
| `yarn db:migrate`       | Run database migrations             |
| `yarn db:seed`          | Seed the database with sample data  |
| `yarn db:studio`        | Open Prisma Studio (database GUI)   |
| `yarn test`             | Run Playwright E2E tests            |
| `yarn test`             | Run tests across all workspaces     |

### App-level (`apps/lfx-changelog`)

| Script             | Description                         |
| ------------------ | ----------------------------------- |
| `yarn start`       | Angular dev server with live reload |
| `yarn build:dev`   | Development build                   |
| `yarn build:prod`  | Production build                    |
| `yarn lint`        | Lint the Angular app                |
| `yarn test`        | Run Playwright E2E tests            |
| `yarn test:headed` | Run E2E tests with browser visible  |
| `yarn test:ui`     | Run E2E tests in Playwright UI mode |

## Project Structure

```text
lfx-changelog/
├── apps/lfx-changelog/           # Angular 20 SSR application
│   ├── src/
│   │   ├── app/
│   │   │   ├── layouts/           # Public and admin layout shells
│   │   │   ├── modules/           # Feature modules (public + admin)
│   │   │   └── shared/            # Components, services, interfaces
│   │   ├── server/                # Express backend
│   │   │   ├── controllers/       # Request handlers
│   │   │   ├── services/          # Business logic + Prisma queries
│   │   │   ├── routes/            # Route definitions
│   │   │   ├── middleware/        # Auth, RBAC, validation, error handling
│   │   │   ├── swagger/           # OpenAPI path definitions
│   │   │   ├── helpers/           # Shared utilities (DB connection, etc.)
│   │   │   └── errors/            # Custom error classes
│   │   └── environments/          # Environment configs
│   ├── prisma/                    # Schema, migrations, seed
│   └── e2e/                       # Playwright E2E tests
│       ├── setup/                 # DB + auth setup projects
│       ├── helpers/               # Test utilities (API, DB, Docker, fixtures)
│       ├── pages/                 # Page Object Model classes
│       └── specs/                 # Test specs (public/, admin/, api/)
├── packages/shared/               # @lfx-changelog/shared (Zod schemas, types, enums)
├── packages/mcp-server/           # @lfx-changelog/mcp-server (MCP tools & resources)
├── charts/lfx-changelog/          # Helm chart for Kubernetes deployment
├── docs/                          # Additional documentation
├── docker-compose.yml             # Local PostgreSQL (dev + test)
├── Dockerfile                     # Multi-stage production build
└── turbo.json                     # Turborepo task config
```

## Architecture

The application uses an Angular SSR server that also hosts the Express API backend. This single-server approach means:

- **Public API** (`/public/api/*`) --- unauthenticated endpoints for reading published changelogs and products
- **Protected API** (`/api/*`) --- authenticated endpoints for CRUD operations, gated by Auth0 and RBAC middleware
- **API docs** (`/docs`) --- interactive Swagger UI generated from Zod schemas via `@asteasolutions/zod-to-openapi`
- **MCP** (`/mcp`) --- Model Context Protocol endpoint for AI tool integration (Streamable HTTP)
- **SSR** --- Angular pages are server-rendered for all routes

### Roles

| Role            | Scope       | Permissions                                         |
| --------------- | ----------- | --------------------------------------------------- |
| `super_admin`   | Global      | Full access to all products, users, and settings    |
| `product_admin` | Per-product | Manage changelogs and editors for assigned products |
| `editor`        | Per-product | Create and edit changelogs for assigned products    |

## Database

The PostgreSQL schema is managed by Prisma with five models:

- **Product** --- LFX products with activation status, Font Awesome icons, and optional GitHub App installation
- **ProductRepository** --- GitHub repositories linked to products for changelog generation
- **ChangelogEntry** --- individual changelog entries with markdown content, versioning, and status tracking
- **User** --- users synced from Auth0 on first login
- **UserRoleAssignment** --- maps users to roles, optionally scoped to a product

### Useful commands

```bash
yarn db:studio          # Browse data in Prisma Studio
yarn db:migrate         # Apply pending migrations
yarn db:seed            # Reset and seed sample data
```

## Testing

End-to-end tests use [Playwright](https://playwright.dev/) to verify the application from a user's perspective. Tests run against a real Angular SSR server backed by a test PostgreSQL database and authenticate through Auth0.

```bash
cd apps/lfx-changelog
yarn test               # Run all tests (headless)
yarn test:headed        # Run with browser visible
yarn test:ui            # Run with Playwright UI mode
```

Tests automatically start a test database container on port 5433, run migrations, seed data, and launch the dev server --- no manual setup needed.

The test suite covers:

- **Public pages** --- changelog feed, product changelogs, theme toggle
- **Admin flows** --- dashboard, changelog editor, product and user management
- **RBAC** --- per-role access (super admin, product admin, editor, no-role)
- **API endpoints** --- public and protected REST endpoints via direct HTTP

See [docs/testing/e2e-testing.md](docs/testing/e2e-testing.md) for the full testing guide.

## CI/CD

GitHub Actions runs on every push to `main` and on pull requests:

| Job             | Description                                                        |
| --------------- | ------------------------------------------------------------------ |
| License headers | Verifies all source files include the required SPDX license header |
| Secret scan     | Scans for leaked secrets using Trufflehog                          |
| E2E tests       | Runs the full Playwright test suite against a test database        |

### Docker Builds

| Workflow                | Trigger                        | Image Tag               |
| ----------------------- | ------------------------------ | ----------------------- |
| `docker-build-main.yml` | Push to `main`                 | `development`           |
| `docker-build-tag.yml`  | Git tag push (`v*`)            | Semver (e.g., `1.2.3`)  |
| `docker-build-pr.yml`   | PR with `deploy-preview` label | `changelog-pr-<number>` |

All images are pushed to **GHCR** (`ghcr.io/linuxfoundation/lfx-changelog`).

### Deployment

The application deploys to **Kubernetes** via **ArgoCD**:

- **Dev:** merge to `main` builds image tagged `development` --- ArgoCD syncs and runs the migration Job before updating pods
- **Prod:** git tag push builds a versioned image + publishes a signed Helm chart (with [Cosign](https://docs.sigstore.dev/cosign/overview/) and [SLSA provenance](https://slsa.dev/)) --- ArgoCD syncs the new chart

Database migrations run automatically as a Helm pre-upgrade Job. See [docs/database-migrations.md](docs/database-migrations.md) for details.

The production container runs as a non-root user on port 4000.

### PR Deploy Previews

Adding the `deploy-preview` label to a PR builds and pushes a branch-specific image. ArgoCD provisions an isolated namespace (`changelog-pr-<number>`) with its own deployment. The preview is removed when the PR is closed or the label is removed.

## Documentation

| Document                                                 | Description                                       |
| -------------------------------------------------------- | ------------------------------------------------- |
| [Database Migrations](docs/database-migrations.md)       | Automated (CI/CD) and manual migration workflows  |
| [Remote Database Access](docs/remote-database-access.md) | Connecting to RDS via kubectl port-forward        |
| [E2E Testing](docs/testing/e2e-testing.md)               | Test architecture, patterns, and how to add tests |
| [Contributing](CONTRIBUTING.md)                          | License headers, code style, commit conventions   |
| [Security](SECURITY.md)                                  | Vulnerability reporting                           |
| [MCP Server](docs/mcp-server.md)                         | MCP tools, resources, and client setup            |
| [Roadmap](PLAN.md)                                       | Implementation plan and upcoming phases           |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on submitting changes, license header requirements, and commit conventions.

## License

[MIT](LICENSE) --- Copyright The Linux Foundation and each contributor to LFX.
