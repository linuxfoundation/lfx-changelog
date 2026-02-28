<!-- Copyright The Linux Foundation and each contributor to LFX. -->
<!-- SPDX-License-Identifier: MIT -->

# E2E Testing

End-to-end tests use [Playwright](https://playwright.dev/) to verify the application works correctly from a user's perspective. Tests run against a real Angular SSR server backed by a test PostgreSQL database and authenticate through Auth0.

## Quick Start

```bash
# From the monorepo root
cd apps/lfx-changelog

# Run all tests (headless)
yarn test

# Run with browser visible
yarn test:headed

# Run with Playwright UI mode
yarn test:ui

# View the last HTML report
yarn test:report
```

> Tests automatically start a test database container, run migrations, seed data, and launch the dev server — no manual setup needed.

## Prerequisites

- **Docker** — test database runs as a `postgres-test` container
- **Node.js 22** with Corepack enabled (for Yarn 4)
- **Auth0 test credentials** — stored in `.env.e2e` locally or GitHub Secrets in CI
- **Playwright Chromium** — install with `npx playwright install chromium --with-deps`

## Directory Structure

```text
apps/lfx-changelog/
├── playwright.config.ts          # Playwright configuration
├── e2e/
│   ├── .auth/                    # Generated auth storage state files
│   │   ├── super-admin.json
│   │   ├── product-admin.json
│   │   ├── editor.json
│   │   └── user.json
│   ├── setup/                    # Setup projects (run before tests)
│   │   ├── seed.setup.ts         # Docker, migrations, database seeding
│   │   └── auth.setup.ts         # Auth0 login for all test roles
│   ├── helpers/                  # Shared utilities
│   │   ├── api.helper.ts         # API request context factories (auth + unauth)
│   │   ├── auth.helper.ts        # Auth0 login/logout functions
│   │   ├── db.helper.ts          # Prisma client, seed, clean, activate/deactivate
│   │   ├── docker.helper.ts      # Docker Compose container management
│   │   └── test-data.ts          # Zod-typed test fixtures (users, products, changelogs)
│   ├── pages/                    # Page Object Model classes
│   │   ├── admin-dashboard.page.ts
│   │   ├── admin-layout.page.ts
│   │   ├── changelog-detail.page.ts
│   │   ├── changelog-editor.page.ts
│   │   ├── changelog-feed.page.ts
│   │   ├── changelog-list.page.ts
│   │   ├── product-changelog.page.ts
│   │   ├── product-detail.page.ts
│   │   ├── product-management.page.ts
│   │   ├── public-layout.page.ts
│   │   └── user-management.page.ts
│   └── specs/                    # Test specifications
│       ├── public/               # Public-facing tests (no auth)
│       │   ├── changelog-detail.spec.ts
│       │   ├── changelog-feed.spec.ts
│       │   ├── product-changelog.spec.ts
│       │   └── theme-toggle.spec.ts
│       ├── admin/                # Admin tests (auth required)
│       │   ├── admin-dashboard.spec.ts
│       │   ├── auth-flow.spec.ts
│       │   ├── changelog-editor.spec.ts
│       │   ├── changelog-list.spec.ts
│       │   ├── product-detail.spec.ts
│       │   ├── product-management.spec.ts
│       │   ├── rbac-editor.spec.ts
│       │   ├── rbac-no-role.spec.ts
│       │   ├── rbac-product-admin.spec.ts
│       │   └── user-management.spec.ts
│       └── api/                  # API tests (no browser, direct HTTP)
│           ├── changelogs.api.spec.ts
│           ├── products.api.spec.ts
│           ├── public-changelogs.api.spec.ts
│           ├── public-products.api.spec.ts
│           └── users.api.spec.ts
```

## Architecture

### Project Pipeline

Playwright is configured with a multi-project pipeline where each project depends on the previous one completing first:

```text
setup ──► auth ──► admin-super-admin
  │         │      admin-rbac
  │         └────► api
  └────► public
```

| Project             | What it does                                       | Depends on      |
| ------------------- | -------------------------------------------------- | --------------- |
| `setup`             | Starts test DB, runs migrations, seeds data        | —               |
| `auth`              | Logs in 4 test roles via Auth0, saves cookies      | `setup`         |
| `public`            | Tests public pages (no auth required)              | `setup`         |
| `admin-super-admin` | Tests admin pages as super admin                   | `auth`          |
| `admin-rbac`        | Tests RBAC (product admin, editor, no-role)        | `auth`          |
| `api`               | Tests API endpoints directly via HTTP (no browser) | `setup`, `auth` |

### Test Database

A dedicated PostgreSQL container (`postgres-test`) runs on port **5433** to avoid conflicts with the dev database on port 5432.

```bash
DATABASE_URL=postgresql://changelog:changelog_dev@localhost:5433/lfx_changelog_test
```

The `db.helper.ts` includes a safety check that **refuses to run** if `DATABASE_URL` does not contain `_test`, preventing accidental wipes of dev/prod databases.

### Database Lifecycle

1. **`startTestDatabase()`** — spins up the `postgres-test` Docker Compose service
2. **`waitForTestDatabase()`** — polls `pg_isready` for up to 30 seconds
3. **`runMigrations()`** — runs `yarn prisma migrate deploy` to apply all migrations
4. **`cleanTestDatabase()`** — deletes all data in FK-safe order (role assignments → changelogs → product repos → products → users)
5. **`seedTestDatabase()`** — upserts test fixtures (products, users, role assignments, changelog entries)

### Authentication

Tests authenticate by automating the full Auth0 / LF SSO login flow in a browser:

1. Navigate to `/login?returnTo=/admin`
2. Wait for redirect to the LF SSO page
3. Fill username and password fields
4. Click "SIGN IN"
5. Wait for redirect back to the app

After login, the browser context's cookies are saved to JSON files under `e2e/.auth/`. Subsequent test projects load these files via `storageState` to skip the login step.

**Test roles:**

| Role            | Storage State File             | Permissions                                 |
| --------------- | ------------------------------ | ------------------------------------------- |
| `super_admin`   | `e2e/.auth/super-admin.json`   | Full access — all products, user management |
| `product_admin` | `e2e/.auth/product-admin.json` | Scoped to assigned products (EasyCLA)       |
| `editor`        | `e2e/.auth/editor.json`        | Edit changelogs for assigned products       |
| `user`          | `e2e/.auth/user.json`          | No admin access — redirected to public feed |

## Patterns and Conventions

### Page Object Model

Every page under test has a corresponding page object class in `e2e/pages/`. Page objects encapsulate:

- **Locators** — initialized in the constructor using `data-testid` attributes
- **Navigation** — a `goto()` method to navigate to the page
- **Actions** — methods for user interactions (clicking, filling forms)

```typescript
import type { Locator, Page } from '@playwright/test';

export class ChangelogFeedPage {
  public readonly heading: Locator;
  public readonly timeline: Locator;

  public constructor(public readonly page: Page) {
    this.heading = page.locator('[data-testid="changelog-feed-heading"]');
    this.timeline = page.locator('[data-testid="changelog-feed-timeline"]');
  }

  public async goto() {
    await this.page.goto('/');
  }

  public getEntryCards(): Locator {
    return this.page.locator('[data-testid^="changelog-card-"]');
  }
}
```

**Rules:**

- Always use `data-testid` attributes for selectors — never rely on CSS classes or DOM structure
- Locators are `readonly` properties initialized in the constructor
- Dynamic locators (that take parameters) are methods returning `Locator`
- Navigation methods are async and use `this.page.goto()`

### Test Structure

Tests follow a consistent pattern:

```typescript
import { expect, test } from '@playwright/test';
import { ProductManagementPage } from '../../pages/product-management.page.js';

test.describe('Product Management', () => {
  let productPage: ProductManagementPage;

  test.beforeEach(async ({ page }) => {
    productPage = new ProductManagementPage(page);
    await productPage.goto();
  });

  test('should display heading', async () => {
    await expect(productPage.heading).toBeVisible();
    await expect(productPage.heading).toContainText('Products');
  });
});
```

### RBAC Tests

RBAC tests use `test.use()` to apply a specific role's storage state:

```typescript
test.describe('RBAC — Product Admin', () => {
  test.use({ storageState: './e2e/.auth/product-admin.json' });

  test('should not have access to user management', async ({ page }) => {
    await page.goto('/admin/users');
    const heading = page.locator('[data-testid="user-management-heading"]');
    await expect(heading).not.toBeVisible();
  });
});
```

### API Tests

API tests verify REST endpoints directly via HTTP without a browser. They use Playwright's `APIRequestContext` instead of page objects.

**File naming:** API specs use the `*.api.spec.ts` suffix and live in `e2e/specs/api/`.

**Helpers:** `api.helper.ts` provides two factory functions:

- `createAuthenticatedContext(role, baseURL)` — reads the saved Auth0 storage state for the given role and attaches session cookies to every request
- `createUnauthenticatedContext(baseURL)` — creates a bare context with no credentials

```typescript
import { expect, test } from '@playwright/test';
import { createAuthenticatedContext, createUnauthenticatedContext } from '../../helpers/api.helper.js';

import type { APIRequestContext } from '@playwright/test';

test.describe('GET /public/api/products', () => {
  let api: APIRequestContext;

  test.beforeAll(async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    api = await createUnauthenticatedContext(baseURL);
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test('should return 200 with product list', async () => {
    const res = await api.get('/public/api/products');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});
```

**What to test in each spec:**

| Spec file                       | Coverage                                                             |
| ------------------------------- | -------------------------------------------------------------------- |
| `public-products.api.spec.ts`   | Public product list, field shape, internal field exclusion, isActive |
| `public-changelogs.api.spec.ts` | Pagination, published-only filter, productId filter, isActive        |
| `products.api.spec.ts`          | Auth 401, RBAC 403, CRUD lifecycle, validation 400                   |
| `changelogs.api.spec.ts`        | Auth 401, RBAC 403, CRUD + publish lifecycle, validation 400         |
| `users.api.spec.ts`             | Auth 401, /me endpoint, list users RBAC, role assign lifecycle       |

**Database helpers for API tests:**

`db.helper.ts` exports `deactivateProduct(slug)` and `activateProduct(slug)` for tests that verify inactive product filtering. Always wrap these in `try/finally` to restore state:

```typescript
await deactivateProduct('e2e-easycla');
try {
  // assertions against the API
} finally {
  await activateProduct('e2e-easycla');
}
```

### Test Data

All test fixtures are defined in `e2e/helpers/test-data.ts` and typed using Zod schemas derived from `@lfx-changelog/shared`. This ensures test data stays in sync with the actual API contracts — if a schema field changes in the shared package, TypeScript will flag the test data at compile time.

- **`TEST_USERS`** — 4 users (super_admin, product_admin, editor, user) with Auth0 IDs derived from usernames (`auth0|<username>`). Typed via `UserSchema.pick().extend()`.
- **`TEST_PRODUCTS`** — 3 products (EasyCLA, Security, Insights) with Font Awesome icons. Typed as `CreateProductRequest[]`.
- **`TEST_ROLE_ASSIGNMENTS`** — Maps product_admin to EasyCLA, editor to EasyCLA. Typed via `UserRoleAssignmentSchema.pick().extend()`.
- **`TEST_CHANGELOGS`** — 4 entries (3 published, 1 draft) across different products. Typed via `CreateChangelogEntryRequestSchema.pick().extend()`.

## Configuration

### Playwright Config (`playwright.config.ts`)

| Setting          | Value                  | Notes                             |
| ---------------- | ---------------------- | --------------------------------- |
| `testDir`        | `./e2e/specs`          | Spec files location               |
| `fullyParallel`  | `false`                | Sequential execution              |
| `workers`        | `1`                    | Single worker (Auth0 rate limits) |
| `retries`        | `2` in CI, `0` locally | Auto-retry in CI                  |
| `timeout`        | `30_000`               | 30s per test                      |
| `expect.timeout` | `10_000`               | 10s for assertions                |
| `trace`          | `on-first-retry`       | Captures trace on retry           |
| `screenshot`     | `only-on-failure`      | Screenshot on failure             |
| `video`          | `retain-on-failure`    | Video on failure                  |

### Web Server

Playwright automatically starts the app server before tests:

```typescript
webServer: {
  command: 'yarn start',
  url: 'http://localhost:4204/health',
  reuseExistingServer: false,
  timeout: 120_000,
}
```

The server must respond on `/health` within 2 minutes. `reuseExistingServer: false` ensures tests always run against a fresh instance.

## Environment Variables

### Required for Local Development (`.env.e2e`)

```bash
# Database
DATABASE_URL=postgresql://changelog:changelog_dev@localhost:5433/lfx_changelog_test

# Auth0
AUTH0_CLIENT_ID=<from AWS Secrets Manager>
AUTH0_CLIENT_SECRET=<from AWS Secrets Manager>
AUTH0_ISSUER_BASE_URL=https://linuxfoundation-dev.auth0.com
AUTH0_SECRET=<cookie signing secret>

# App
BASE_URL=http://localhost:4204
SKIP_RATE_LIMIT=true

# Test Users (one set per role — Auth0 IDs are derived as auth0|<username>)
E2E_SUPER_ADMIN_USERNAME=<username>
E2E_SUPER_ADMIN_PASSWORD=<password>
E2E_PRODUCT_ADMIN_USERNAME=<username>
E2E_PRODUCT_ADMIN_PASSWORD=<password>
E2E_EDITOR_USERNAME=<username>
E2E_EDITOR_PASSWORD=<password>
E2E_USER_USERNAME=<username>
E2E_USER_PASSWORD=<password>
```

### CI (GitHub Actions)

In CI, credentials come from two sources:

- **AWS Secrets Manager** — Auth0 client ID, client secret, cookie secret
- **GitHub Secrets** — Test user usernames, passwords, and Auth0 IDs

See `.github/workflows/ci.yml` for the full pipeline.

## CI Pipeline

The `e2e` job in `.github/workflows/ci.yml` runs on every push to `main` and on pull requests:

1. Checkout code
2. Enable Corepack + setup Node.js 22
3. `yarn install --immutable`
4. `yarn workspace lfx-changelog prisma generate`
5. Configure AWS credentials (OIDC federation)
6. Read Auth0 secrets from AWS Secrets Manager
7. Set environment variables (non-sensitive + test user credentials)
8. Install Playwright Chromium
9. `yarn playwright test` (from `apps/lfx-changelog`)
10. `docker compose down postgres-test` (cleanup, runs even on failure)

## Adding New Tests

### 1. Add `data-testid` attributes to the component template

```html
<h1 data-testid="my-feature-heading">My Feature</h1>
<button data-testid="my-feature-save-btn">Save</button>
```

### 2. Create a page object

```typescript
// e2e/pages/my-feature.page.ts
import type { Locator, Page } from '@playwright/test';

export class MyFeaturePage {
  public readonly heading: Locator;
  public readonly saveBtn: Locator;

  public constructor(public readonly page: Page) {
    this.heading = page.locator('[data-testid="my-feature-heading"]');
    this.saveBtn = page.locator('[data-testid="my-feature-save-btn"]');
  }

  public async goto() {
    await this.page.goto('/my-feature');
  }
}
```

### 3. Create a spec file

Place it in `e2e/specs/public/` or `e2e/specs/admin/` depending on whether it needs authentication:

```typescript
// e2e/specs/admin/my-feature.spec.ts
import { expect, test } from '@playwright/test';
import { MyFeaturePage } from '../../pages/my-feature.page.js';

test.describe('My Feature', () => {
  let myPage: MyFeaturePage;

  test.beforeEach(async ({ page }) => {
    myPage = new MyFeaturePage(page);
    await myPage.goto();
  });

  test('should display heading', async () => {
    await expect(myPage.heading).toBeVisible();
  });
});
```

### 4. If testing a new role, add RBAC tests

```typescript
// e2e/specs/admin/rbac-my-role.spec.ts
test.describe('RBAC — My Role', () => {
  test.use({ storageState: './e2e/.auth/my-role.json' });

  test('should/should not have access', async ({ page }) => {
    // ...
  });
});
```

### 5. Adding an API test

API tests don't need page objects or `data-testid` attributes. Place the spec in `e2e/specs/api/` with the `*.api.spec.ts` suffix:

```typescript
// e2e/specs/api/my-endpoint.api.spec.ts
import { expect, test } from '@playwright/test';
import { createAuthenticatedContext } from '../../helpers/api.helper.js';

import type { APIRequestContext } from '@playwright/test';

test.describe('POST /api/my-endpoint', () => {
  let api: APIRequestContext;

  test.beforeAll(async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    api = await createAuthenticatedContext('super_admin', baseURL);
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test('should create a resource', async () => {
    const res = await api.post('/api/my-endpoint', {
      data: { name: 'Test' },
    });
    expect(res.status()).toBe(201);
  });
});
```

The `api` project in `playwright.config.ts` matches `api/*.api.spec.ts` automatically — no config changes needed.

## Troubleshooting

| Problem                                        | Solution                                                                                                          |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Tests fail with "postgres-test not ready"      | Ensure Docker is running. Check `docker context ls` — the active context must be `default` (not a remote server)  |
| Auth0 login times out                          | Check `.env.e2e` credentials. Auth0 may rate-limit after too many attempts — wait a few minutes                   |
| `reuseExistingServer: false` blocks test start | Stop any running dev server on port 4204                                                                          |
| Storage state file not found                   | Run the `auth` project first: `yarn playwright test --project=auth`                                               |
| Prisma migration errors                        | Ensure `DATABASE_URL` points to the test database (port 5433). Run `yarn prisma migrate deploy` manually to debug |
| Tests pass locally but fail in CI              | Check that all GitHub Secrets are set. The CI job masks secrets — look for `***` in logs to verify they're loaded |
