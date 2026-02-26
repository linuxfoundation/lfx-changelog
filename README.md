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

## Tech Stack

| Layer    | Technology                                            |
| -------- | ----------------------------------------------------- |
| Monorepo | Turborepo + Yarn 4 workspaces                         |
| Frontend | Angular 20 (standalone components, signals, zoneless) |
| Backend  | Express 5 (via Angular SSR server)                    |
| Database | PostgreSQL 16                                         |
| ORM      | Prisma 7 with driver adapter                          |
| Auth     | Auth0 (`express-openid-connect`)                      |
| Styling  | Tailwind CSS 4 (CSS-first config, custom components)  |
| CI/CD    | GitHub Actions, AWS ECS Fargate                       |

## Prerequisites

- **Node.js** >= 22
- **Yarn** 4.12.0 (managed via Corepack)
- **Docker** and **Docker Compose** (for PostgreSQL)

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/nicholasgasior/lfx-changelog.git
cd lfx-changelog
corepack enable
yarn install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` with your values. See the [Environment Variables](#environment-variables) section below for details.

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

The app runs at `http://localhost:4200` (Angular dev server) with the API at `http://localhost:4000`.

## Environment Variables

| Variable                | Required | Description                                                                                              |
| ----------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | Yes      | PostgreSQL connection string (e.g., `postgresql://changelog:changelog_dev@localhost:5432/lfx_changelog`) |
| `AUTH0_CLIENT_ID`       | Yes      | Auth0 application client ID                                                                              |
| `AUTH0_CLIENT_SECRET`   | Yes      | Auth0 application client secret                                                                          |
| `AUTH0_ISSUER_BASE_URL` | Yes      | Auth0 tenant URL (e.g., `https://your-tenant.auth0.com`)                                                 |
| `AUTH0_AUDIENCE`        | Yes      | Auth0 API audience identifier                                                                            |
| `AUTH0_SECRET`          | Yes      | Session encryption secret (min 32 characters)                                                            |
| `BASE_URL`              | Yes      | Application base URL (e.g., `http://localhost:4000`)                                                     |
| `GITHUB_APP_ID`         | No       | GitHub App ID for repository integration                                                                 |
| `GITHUB_PRIVATE_KEY`    | No       | GitHub App RSA private key                                                                               |
| `LITELLM_API_KEY`       | No       | API key for AI changelog generation                                                                      |
| `AI_API_URL`            | No       | AI service endpoint URL                                                                                  |
| `NODE_ENV`              | No       | `development` or `production` (default: `development`)                                                   |
| `PORT`                  | No       | Server port (default: `4000`)                                                                            |
| `LOG_LEVEL`             | No       | Logging level: `debug`, `info`, `warn`, `error` (default: `info`)                                        |

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

### App-level (`apps/lfx-changelog`)

| Script            | Description                         |
| ----------------- | ----------------------------------- |
| `yarn start`      | Angular dev server with live reload |
| `yarn build:dev`  | Development build                   |
| `yarn build:prod` | Production build                    |
| `yarn lint`       | Lint the Angular app                |

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
│   │   │   ├── middleware/        # Auth, RBAC, error handling
│   │   │   └── errors/            # Custom error classes
│   │   └── environments/          # Environment configs
│   └── prisma/                    # Schema, migrations, seed
├── packages/shared/               # @lfx-changelog/shared (types, enums, constants)
├── docker-compose.yml             # Local PostgreSQL
├── Dockerfile                     # Multi-stage production build
└── turbo.json                     # Turborepo task config
```

## Architecture

The application uses an Angular SSR server that also hosts the Express API backend. This single-server approach means:

- **Public API** (`/public/api/*`) --- unauthenticated endpoints for reading published changelogs and products
- **Protected API** (`/api/*`) --- authenticated endpoints for CRUD operations, gated by Auth0 and RBAC middleware
- **SSR** --- Angular pages are server-rendered for all routes

### Roles

| Role            | Scope       | Permissions                                         |
| --------------- | ----------- | --------------------------------------------------- |
| `super_admin`   | Global      | Full access to all products, users, and settings    |
| `product_admin` | Per-product | Manage changelogs and editors for assigned products |
| `editor`        | Per-product | Create and edit changelogs for assigned products    |

## Database

The PostgreSQL schema is managed by Prisma with four main models:

- **Product** --- LFX products (e.g., Security, EasyCLA, Insights)
- **ChangelogEntry** --- individual changelog entries with markdown content, versioning, and status tracking
- **User** --- users synced from Auth0 on first login
- **UserRoleAssignment** --- maps users to roles, optionally scoped to a product

### Useful commands

```bash
yarn db:studio          # Browse data in Prisma Studio
yarn db:migrate         # Apply pending migrations
yarn db:seed            # Reset and seed sample data
```

## Deployment

The application deploys to **AWS ECS Fargate** via GitHub Actions:

1. Push to `main` triggers the `deploy-dev.yml` workflow
2. Docker image is built and pushed to AWS ECR
3. ECS task definition is registered and service is updated
4. Secrets are pulled from AWS Secrets Manager at runtime

The production container runs as a non-root user on port 4000.

## Roadmap

See [PLAN.md](PLAN.md) for the full implementation plan and upcoming phases.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on submitting changes, license header requirements, and commit conventions.

## License

[MIT](LICENSE) --- Copyright The Linux Foundation and each contributor to LFX.
