# LFX Changelog — Project Rules

## Project Overview

Monorepo: Turborepo + Yarn 4 workspaces. Angular 20 SSR app at `apps/lfx-changelog`, shared package at `packages/shared` (`@lfx-changelog/shared`), MCP server at `packages/mcp-server`. Express 5 backend, PostgreSQL + Prisma ORM, Auth0, OpenSearch, Slack OAuth, GitHub App webhooks, Datadog APM/RUM. See `docs/` for feature-level documentation.

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
