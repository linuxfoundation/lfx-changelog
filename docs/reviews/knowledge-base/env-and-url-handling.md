<!-- Copyright The Linux Foundation and each contributor to LFX. -->
<!-- SPDX-License-Identifier: MIT -->

# Environment variable and URL handling

Patterns extracted from past PR review comments about env vars, base URLs,
and OTLP/CORS/SEO endpoint construction.

## `??` does not catch empty-string env vars; use `||` or trim-and-check

Helm charts in this repo can render an env var with `value: ''` rather than
omitting it, so `process.env['X'] ?? fallback` still resolves to `''`, not
the fallback. Any code that later concatenates a path onto that value
produces a broken URL (e.g. `/v1/traces` with no host). Treat empty/whitespace
as unset explicitly, and normalize trailing slashes before appending a path.

- Source: PR #162, `apps/lfx-changelog/otel.mjs` — `OTEL_EXPORTER_OTLP_ENDPOINT`
  used `??`, producing invalid exporter URLs when the Helm chart set an empty
  string; fixed by trimming, falling back with `||`, and stripping trailing
  slashes. The Helm chart fix removed the key entirely rather than shipping
  `value: ''`, and left the per-environment ArgoCD overlay to set it.

## `BASE_URL` / similar base paths need trailing-slash normalization once, at the source

A `BASE_URL` with a trailing slash propagates into every consumer that does
naive string concatenation (SEO meta tags, OG/Twitter image URLs), producing
double slashes. Normalize once where the env var is read (e.g. in
`ssr.ts`'s runtime config construction) rather than in every consumer,
matching the existing pattern in `getCorsOrigins()` (`src/server/constants/cors.constants.ts`).

- Source: PR #92, `apps/lfx-changelog/src/server/setup/ssr.ts` and
  `apps/lfx-changelog/src/app/shared/services/seo.service.ts` — both fixed
  to trim trailing slashes, described as "belt-and-suspenders" — the intent
  is to normalize at the source, not scatter the fix.

## Static asset paths must match the actual Angular assets config

Meta tags / constants referencing `/assets/<file>` will 404 if the Angular
build only copies static files from `apps/lfx-changelog/public` — check
`apps/lfx-changelog/angular.json`'s assets config before adding a new
`/assets/...` reference, and confirm the file actually exists at the path
that will be served.

- Source: PR #92, `packages/shared/src/constants/seo.constant.ts` and
  `apps/lfx-changelog/src/index.html` — `DEFAULT_OG_IMAGE` and OG/Twitter
  meta tags referenced `/assets/og-default.png`, which didn't exist under
  `public/`; fixed to point at an asset that does (`/logo_lfx.svg`).
