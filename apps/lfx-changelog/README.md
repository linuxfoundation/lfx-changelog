<!-- Copyright The Linux Foundation and each contributor to LFX. -->
<!-- SPDX-License-Identifier: MIT -->

# LFX Changelog App

Angular 20 SSR application with an Express 5 backend. This is the main workspace in the [lfx-changelog](../../README.md) monorepo.

## Development

```bash
# from the monorepo root
yarn workspace lfx-changelog start   # dev server at http://localhost:4204
```

Or directly from this directory (`apps/lfx-changelog`):

```bash
yarn start            # ng serve (live reload)
yarn build:dev        # development build
yarn build:prod       # production build
yarn lint             # ESLint
```

## Source Layout

```text
src/
├── app/
│   ├── layouts/          # Public and admin layout shells
│   ├── modules/
│   │   ├── public/       # Public-facing pages (feed, detail, blog, chat)
│   │   ├── admin/        # Authenticated admin pages (dashboard, editors, management)
│   │   └── chat/         # Shared chat module
│   └── shared/           # Reusable components, services, pipes, guards, and utils
├── server/
│   ├── controllers/      # Request handlers
│   ├── services/         # Business logic and Prisma queries
│   ├── routes/           # Public (/public/api/*) and protected (/api/*) route definitions
│   ├── middleware/        # Auth, RBAC, validation, error handling
│   ├── swagger/          # OpenAPI path definitions (serves Swagger UI at /docs)
│   ├── setup/            # Server initialization and bootstrapping
│   ├── helpers/          # DB connection, shared utilities
│   └── errors/           # Custom error classes
└── environments/         # Environment configs
```

The server follows a **Controller → Service** pattern. Public endpoints serve unauthenticated read access, while protected endpoints enforce [Auth0 sessions or API keys](../../docs/api-authentication.md) with [role-based access control](../../README.md#roles). For more on individual server features, see the [docs](../../docs/) covering the [AI chat](../../docs/ai-chat.md), [changelog agent](../../docs/changelog-agent.md), [GitHub integration](../../docs/github-integration.md), [OpenSearch](../../docs/opensearch.md), and [Slack integration](../../docs/slack-integration.md).

## Database

Prisma schema and migrations live in `prisma/`. See the root README for migration instructions.

```bash
yarn prisma studio    # browse data in Prisma Studio
yarn prisma generate  # regenerate Prisma client
```

## Testing

Playwright E2E tests live in `e2e/` with Page Object Model classes and spec files organized by area.

```bash
yarn test             # headless
yarn test:headed      # browser visible
yarn test:ui          # Playwright UI mode
yarn test:report      # open last HTML report
```

Tests auto-start a test database on port 5433, run migrations, seed data, and launch the dev server. See [E2E Testing](../../docs/testing/e2e-testing.md) for details.

## Environment

Copy `.env.example` to `.env` and fill in the values. See the [root README](../../README.md#environment-variables) for the full variable reference.
