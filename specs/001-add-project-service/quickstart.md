# Quickstart: Validate LFX V2 Project Service Tracking

**Feature**: `001-add-project-service`  
**Date**: 2026-06-17  
**Last validated**: 2026-06-17 (implementation — local dev + automated API tests)

End-to-end validation guide. See [data-model.md](./data-model.md) and [contracts/product-onboarding.md](./contracts/product-onboarding.md) for details.

## Prerequisites

- Node.js >= 22, Yarn 4, Docker
- LFX Changelog running locally (`yarn dev` from repo root)
- PostgreSQL seeded (`yarn workspace @lfx-changelog/app prisma db seed`)
- GitHub App credentials in `.env` (`GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`)
- GitHub App installed on `linuxfoundation` org with access to `lfx-v2-project-service`
- Super admin Auth0 session (or API key with `SUPER_ADMIN`)

## Scenario 1: Product appears in public catalog

**Production onboarding (super admin)**

1. Log in as super admin → **Admin → Products → Add Product**.
2. Enter:
   - Name: `LFX V2 Project Service`
   - Slug: `lfx-v2-project-service`
   - Description: RESTful API for creating, reading, updating, and deleting projects within the LFX platform, with built-in authorization and audit capabilities.
   - Icon: `fa-duotone fa-diagram-project`
3. Save product.
4. Open `/` or `/products` as an unauthenticated visitor.

**Expected**: Product card appears with correct name, description, and icon.

```bash
curl -s http://localhost:4200/public/api/products | jq '.data[] | select(.slug=="lfx-v2-project-service")'
```

**Local dev shortcut**: `prisma db seed` creates the product with slug `lfx-v2-project-service`.

---

## Scenario 2: Repository linked without historical backfill

**Production onboarding (super admin)**

1. Open product detail → **Repositories** tab.
2. Click **Connect Repository** → complete GitHub App flow for `linuxfoundation/lfx-v2-project-service`.
3. Confirm repository appears in linked list.
4. As super admin, trigger sync (Repositories admin page or API):

```bash
curl -X POST http://localhost:4200/api/releases/sync/<productId> \
  -H "Cookie: <session>" -H "Content-Type: application/json"
```

**Expected**:
- `synced: 0` (no releases published after link yet).
- Admin release list does **not** show ~37 historical tags (e.g. `v0.8.2`).
- Manual sync skips releases with `publishedAt < ProductRepository.createdAt` (see `docs/github-integration.md`).

**API contract**: `POST /api/products/{productId}/repositories` with `fullName: linuxfoundation/lfx-v2-project-service`.

---

## Scenario 3: Changelog team can curate entries

**Production onboarding (super admin assigns RBAC)**

1. Super admin assigns `product_admin` on this product to LFX platform/changelog team members (**Admin → Users → Roles**).
2. Log in as that product admin.
3. Create a draft changelog entry for the product (**Admin → Changelogs → New**).
4. Publish the entry.

**Expected**:
- Product admin can create/edit/publish without super admin.
- Published entry visible at `/products/lfx-v2-project-service`.

**Agent automation**: When webhooks fire (Scenario 4), `ChangelogAgentService` may create automated drafts (`source: automated`). Product admins review drafts in **Admin → Changelogs** before publishing.

---

## Scenario 4: New GitHub release syncs via webhook

**Prerequisites**: Webhook endpoint reachable (ngrok or deployed env); or use [webhook testing guide](../../../docs/webhook-testing.md).

1. Publish a new release on `linuxfoundation/lfx-v2-project-service` (or send test `release` webhook payload).
2. Wait ≤ 5 minutes (SC-003).
3. Check admin **Repositories** page for new release row.
4. Check **Changelogs** for agent-generated draft (may take longer depending on agent queue).

**Expected**:
- `GitHubRelease` record for new tag via `WebhookController` → `GitHubService.upsertReleaseFromWebhook`.
- Draft `ChangelogEntry` with `source: automated` (if agent pipeline enabled).
- Agent job triggered asynchronously after webhook ACK (see `changelog-agent.service.ts`).

**Webhook events handled**: `release` (published/created/edited), `push` (default branch), `pull_request` (merged to default).

---

## Scenario 5: Dev seed parity

```bash
yarn workspace @lfx-changelog/app prisma db seed
```

**Expected**: Product `lfx-v2-project-service` exists in local DB (repository link still requires GitHub App in dev).

---

## Automated test commands

```bash
# API E2E (products + releases + public catalog)
yarn workspace @lfx-changelog/app e2e --grep "products|releases|public"

# Full E2E (optional)
yarn workspace @lfx-changelog/app e2e
```

**Implemented API coverage**:
- `public-products.api.spec.ts` — LFX V2 Project Service catalog metadata
- `products.api.spec.ts` — create product with approved metadata
- `releases.api.spec.ts` — super_admin sync endpoint authorization

---

## Rollback

1. Unlink repository: **Admin → Product → Repositories → Unlink**.
2. Delete product (super admin only) if onboarding failed.
3. Remove `product_admin` role assignments for the product.

---

## Production checklist

- [ ] Product created with approved metadata
- [ ] GitHub App has repo access
- [ ] Repository linked; no historical releases imported
- [ ] Changelog team assigned `product_admin`
- [ ] Webhook delivery confirmed for `release` events
- [ ] First post-connection release visible in admin within 5 minutes
- [ ] First changelog entry published within first week (SC-005)

---

## Implementation validation log

| Check | Status | Notes |
|-------|--------|-------|
| Seed product `lfx-v2-project-service` | ✅ | `apps/lfx-changelog/prisma/seed.ts` |
| E2E fixture `e2e-lfx-v2-project-service` | ✅ | `e2e/helpers/test-data.ts` |
| Sync cutoff `publishedAt >= createdAt` | ✅ | `github.service.ts` |
| Public API metadata test | ✅ | `public-products.api.spec.ts` |
| Product create API test | ✅ | `products.api.spec.ts` |
| Release sync RBAC test | ✅ | `releases.api.spec.ts` |
| GitHub integration docs | ✅ | `docs/github-integration.md` |
| Production webhook validation | ⏳ | Requires deployed env + GitHub App |
