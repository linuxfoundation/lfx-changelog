---
paths:
  - 'apps/lfx-changelog/e2e/**'
  - 'apps/lfx-changelog/playwright.config.ts'
---

# E2E Testing (Playwright)

- Config at `apps/lfx-changelog/playwright.config.ts`, uses `.env.e2e` and `http://localhost:4204`
- Run with `yarn test` from `apps/lfx-changelog`
- **Page Object pattern:** one `*.page.ts` per page in `e2e/pages/`, specs import page objects
- **Test structure:** `e2e/specs/admin/` (authenticated), `e2e/specs/public/` (unauthenticated), `e2e/specs/api/` (API tests)
- **Helpers:** `e2e/helpers/` for auth, API, toast, DB, Docker, and test data utilities
- **Setup projects** handle Docker, migrations, and seeding automatically
- Workers: 1 (sequential) — `fullyParallel: false`
- Traces on first retry, screenshots on failure, video retained on failure
