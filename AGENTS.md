# LFX Changelog — Project Rules

## Project Overview

Monorepo: Turborepo + Yarn 4 workspaces. Angular 20 SSR app at `apps/lfx-changelog`, shared package at `packages/shared` (`@lfx-changelog/shared`), MCP server at `packages/mcp-server`. Express 5 backend, PostgreSQL + Prisma ORM, Auth0, OpenSearch, Slack OAuth, GitHub App webhooks, Datadog APM/RUM. See `docs/` for feature-level documentation and `.claude/rules/` for area-specific rules (Angular components, Prisma migrations, Playwright E2E).

---

## Commands

```bash
yarn build            # turbo build of shared → mcp-server → app; the ONLY typecheck gate
yarn lint             # ESLint only — passes on code that won't compile
yarn start            # dev server on http://localhost:4204
yarn docker:up        # local Postgres/OpenSearch
yarn db:generate      # regenerate Prisma client — required after any prisma/@prisma/* bump (no postinstall hook)
yarn workspace lfx-changelog test   # Playwright E2E (uses .env.e2e + *-test containers)
```

See `README.md` for env vars, setup and the full script list.

---

## Styling

- **Tailwind CSS v4** — CSS-first config via `@theme` block in `styles.css`, no `tailwind.config.js`
- **`.css` files only** — no SCSS (Tailwind v4 CSS-first approach makes SCSS unnecessary)
- **Semantic color tokens** — use `bg-surface`, `text-text-primary`, `border-border` etc. (defined as CSS custom properties that swap in `.dark {}` block)
- **Light mode default** — dark mode toggled via `.dark` class on `<html>`
- **ALWAYS use Tailwind CSS in HTML first** instead of custom CSS classes
- Only use custom `.css` when absolutely necessary: complex animations (`@keyframes`), pseudo-elements, prose/markdown styling, complex state selectors

---

## Tooling Preferences

- **Prefer `yarn` workspace scripts/binaries over `npx`** when the tool is in the monorepo deps (e.g., `yarn prisma generate` instead of `npx prisma generate`)
  - `npx` is allowed for one-off tools not in the workspace or when required by upstream docs/CI (e.g., `npx playwright`, `npx @modelcontextprotocol/inspector`, `npx tsx`)
- **Always use `docker compose`** instead of `docker-compose`
- **Use `yarn lint` to lint** — not `yarn eslint`

---

## Gotchas

- **Pre-commit hook** runs `check-headers.sh`, `yarn format` (re-stages files), `yarn lint` and `yarn build` — commits are slow and may reformat staged files.
- **License header** (`Copyright The Linux Foundation…` / `SPDX-License-Identifier: MIT`) is required on every source file; CI enforces it.
- **`turbo.json` has `agentGuidance: false`** deliberately — without it turbo rewrites this file with its own boilerplate.
- **Dependency upgrades:** Angular packages stay within the current major (range updates only); `@opensearch-project/opensearch` is held at `~3.6.0` until opensearch-js#1154 (3.9.0 drops `field` from terms aggregation types) is fixed.
