<!-- Copyright The Linux Foundation and each contributor to LFX. -->
<!-- SPDX-License-Identifier: MIT -->

# GitHub Integration

The LFX Changelog integrates with GitHub through a **GitHub App** to track repositories, sync releases, and automatically generate changelog entries from merged pull requests and commits. This document covers the full integration: GitHub App setup, repository tracking, release syncing, webhook processing, and AI-powered changelog generation.

## Overview

| Component               | Description                                                             |
| ----------------------- | ----------------------------------------------------------------------- |
| **GitHub App**          | Authenticates with GitHub on behalf of installed organizations          |
| **Repository tracking** | Links GitHub repos to LFX products via the admin UI                     |
| **Release sync**        | Stores GitHub release metadata in the database (manual sync + webhooks) |
| **Webhook endpoint**    | Receives GitHub events (releases, pushes, merged PRs)                   |
| **Automated changelog** | AI generates draft changelog entries from GitHub activity               |
| **Author reassignment** | Super admins can reassign changelog authorship to any user              |

## GitHub App Authentication

The integration uses a GitHub App (not a personal access token or OAuth App). GitHub Apps authenticate with short-lived installation tokens scoped to specific repositories.

### How It Works

1. **JWT generation** --- The server creates a 10-minute JWT signed with the App's RSA private key (`GITHUB_PRIVATE_KEY`) and App ID (`GITHUB_APP_ID`)
2. **Installation token exchange** --- The JWT is exchanged for an installation access token scoped to the organization's installed repositories
3. **API calls** --- All GitHub API requests use the installation token, which auto-expires after 1 hour

### Environment Variables

| Variable                | Required | Description                                                         |
| ----------------------- | -------- | ------------------------------------------------------------------- |
| `GITHUB_APP_ID`         | Yes      | GitHub App ID (found in the App's settings page)                    |
| `GITHUB_PRIVATE_KEY`    | Yes      | RSA private key in PEM format (newlines escaped as `\n` in `.env`)  |
| `GITHUB_WEBHOOK_SECRET` | Yes      | Secret for HMAC-SHA256 webhook signature verification               |
| `WEBHOOK_STATE_SECRET`  | No       | HMAC secret for CSRF-protected GitHub App install flow state tokens |

## Repository Tracking

Products can be linked to one or more GitHub repositories. This enables release syncing and changelog generation based on the repositories' activity.

### Admin UI Flow

1. Navigate to a product's detail page in the admin dashboard
2. Click **Connect Repository** to initiate the GitHub App installation flow
3. Select an organization and grant access to specific repositories
4. After installation, linked repositories appear in the product's repository list

### Data Model

Each tracked repository is stored as a **ProductRepository** record linking a product to a GitHub repo. Key fields include the GitHub App installation ID, owner/name/fullName identifiers, the repository URL, and a `lastSyncedAt` timestamp updated on each sync. Repositories are uniquely constrained per product + owner + name.

### API Endpoints

| Method | Path                                         | Auth       | Description                         |
| ------ | -------------------------------------------- | ---------- | ----------------------------------- |
| GET    | `/api/github/install-url?productId=<id>`     | OAuth only | Get signed GitHub App install URL   |
| GET    | `/webhooks/github-app-callback`              | None       | GitHub redirects here after install |
| GET    | `/api/github/installations`                  | OAuth only | List GitHub App installations       |
| GET    | `/api/github/installations/:id/repositories` | OAuth only | List repos for an installation      |

## Release Syncing

GitHub releases are stored in the database and displayed on the admin repositories page. Releases sync via two mechanisms:

### 1. Webhook-Driven (Real-Time)

When a `release` event arrives via webhook, the release is upserted or deleted immediately. See [Webhook Processing](#webhook-processing) below.

### 2. Manual Full Sync

Triggered from the admin UI for a specific product. Fetches up to 100 releases per repository via the GitHub API and upserts them all.

### Release Data Model

Each synced release is stored as a **GitHubRelease** record linked to a ProductRepository. Key fields include GitHub's release ID, tag name, release name, HTML URL, markdown body (release notes), draft/prerelease flags, publish date, and author info (login + avatar URL). Releases are uniquely constrained per repository + GitHub ID and indexed by publish date for efficient ordering.

## Webhook Processing

### Endpoint

`POST /webhooks/github`

### Authentication

All webhook requests are verified using **HMAC-SHA256** signatures:

- Header: `X-Hub-Signature-256` with format `sha256=<hex>`
- Secret: `GITHUB_WEBHOOK_SECRET` environment variable
- Verification uses `crypto.timingSafeEqual()` to prevent timing attacks

### Body Size Limit

The webhook endpoint accepts payloads up to **1 MB** (configured via `express.raw({ limit: '1mb' })`). GitHub release payloads can exceed 275 KB due to lengthy release notes.

### Handled Events

| GitHub Event   | Actions Processed                | Behavior                                                        |
| -------------- | -------------------------------- | --------------------------------------------------------------- |
| `release`      | `published`, `created`, `edited` | Upserts the release in the database                             |
| `release`      | `deleted`                        | Deletes the release from the database                           |
| `push`         | Any                              | Triggers auto-changelog (only for pushes to default branch)     |
| `pull_request` | `closed` (with `merged: true`)   | Triggers auto-changelog (only for PRs merged to default branch) |

All other event types are acknowledged with `200 OK` and silently ignored.

### Repository Matching

The webhook validates `repository.full_name` against the `ProductRepository` table. If the repository is not tracked by any product, the event is ignored with a log entry:

```text
INFO: GitHub webhook release event for untracked repository — ignoring  repoFullName=...
```

### PR Target Branch Checking

For `pull_request` events, the webhook only processes PRs merged to the repository's **default branch** (typically `main`). This prevents changelog generation from feature-branch merges:

```text
Checks:
1. action === 'closed'
2. pull_request.merged === true
3. pull_request.base.ref === repository.default_branch
```

### Processing Flow

```text
Webhook received
  │
  ├─ Verify HMAC signature
  ├─ Parse event type from X-GitHub-Event header
  ├─ Look up ProductRepository records by repository.full_name
  │
  ├─ Is release event?
  │   ├─ YES: Upsert/delete GitHubRelease synchronously
  │   └─ Update ProductRepository.lastSyncedAt
  │
  ├─ Return 200 OK immediately
  │
  └─ ASYNC: Trigger auto-changelog generation per product (deduplicated)
```

## Automated Changelog Generation

When GitHub activity is detected via webhooks, the system asynchronously generates a draft changelog entry using AI. This is the core feature that turns raw GitHub activity into human-readable release notes.

### Trigger Points

Auto-changelog generation is triggered by:

- `release` events (published, created, edited)
- `push` events (to the default branch)
- `pull_request` events (merged to the default branch)

### Distributed Lock

Multiple server replicas may receive webhooks simultaneously. A database-based distributed lock (**AutoChangelogLock**, keyed by product ID) prevents duplicate generation. Each lock tracks a status (`in_progress` or `pending_rerun`) and a `lockedAt` timestamp.

**Lock behavior:**

| Scenario               | Action                                                                          |
| ---------------------- | ------------------------------------------------------------------------------- |
| No lock exists         | Insert lock with `in_progress` --- generation begins                            |
| Lock exists (< 10 min) | Set status to `pending_rerun` --- generation will re-run after current finishes |
| Lock exists (> 10 min) | Reclaim stale lock (crashed replica recovery)                                   |

If `pending_rerun` is set during generation, the system re-runs once more after the current generation completes. This catches multiple rapid webhook events.

### Generation Flow

```text
1. Ensure bot user exists
   └─ email: changelog-bot@linuxfoundation.org
   └─ name: LFX Changelog Bot

2. Determine "since" date
   └─ Last published changelog's publishedAt (or createdAt)
   └─ Fallback: 30 days ago

3. Fetch GitHub activity (per repository)
   ├─ Commits since date (max 500, paginated)
   ├─ Merged PRs since date (max 500, paginated)
   └─ Stored GitHubRelease records since date

4. Build AI context
   └─ Organize by repository (max 50 PRs, 50 commits per repo)
   └─ Format as markdown for AI consumption

5. AI generation (parallel)
   ├─ Generate title + version (JSON)
   └─ Generate markdown description

6. Create or update draft
   ├─ Existing automated draft? → Update with new content
   └─ No existing draft? → Create with source='automated', createdBy=bot
```

### Changelog Source Tracking

Each changelog entry has a `source` field: `manual` (created by a human) or `automated` (generated by AI from GitHub activity).

Automated changelogs are created as **drafts** and must be reviewed and published by a human. The system updates the same draft if the product already has an automated draft in progress, rather than creating duplicates.

### Bot User

All automated changelogs are attributed to a dedicated bot user:

- **Email:** `changelog-bot@linuxfoundation.org`
- **Name:** LFX Changelog Bot
- Created on-demand if it doesn't exist

## Author Reassignment

Super admins can reassign the author of any changelog entry (both manual and automated) to a different user.

### Authorization

| Role            | Can Reassign?                               |
| --------------- | ------------------------------------------- |
| `super_admin`   | Yes --- can reassign to any user            |
| `product_admin` | No --- can only update their own changelogs |
| `editor`        | No --- can only update their own changelogs |

### API

`PATCH /api/changelogs/:id` with `{ "createdBy": "<target-user-id>" }` in the request body.

The endpoint validates that:

1. The requesting user has `super_admin` role (for cross-user reassignment)
2. The target user exists in the database

### Frontend

The changelog editor shows an author reassignment section for super admins. Selecting a different user triggers a button-confirmed action with loading state to prevent accidental reassignment.

## Unpublish and Delete

### Unpublish

Reverts a published changelog entry to **draft** status and removes it from the public feed and search index.

| Detail    | Value                                           |
| --------- | ----------------------------------------------- |
| Endpoint  | `PATCH /api/changelogs/:id/unpublish`           |
| Min. role | `editor` (scoped to product)                    |
| Effect    | Sets `status: 'draft'`, clears `publishedAt`    |
| Search    | Removes document from OpenSearch asynchronously |

### Delete

Permanently deletes a changelog entry from the database.

| Detail    | Value                                           |
| --------- | ----------------------------------------------- |
| Endpoint  | `DELETE /api/changelogs/:id`                    |
| Min. role | `product_admin` (scoped to product)             |
| Effect    | Deletes the database row                        |
| Search    | Removes document from OpenSearch asynchronously |
| Response  | `204 No Content`                                |

Both actions show a confirmation dialog in the frontend before proceeding.

## Architecture

### File Structure

```text
apps/lfx-changelog/src/server/
├── controllers/
│   ├── webhook.controller.ts       # Webhook event routing + auto-changelog trigger
│   └── github.controller.ts        # GitHub App install flow + repo management
├── services/
│   ├── github.service.ts           # GitHub API client (JWT auth, API calls)
│   ├── release.service.ts          # Release CRUD + sync logic
│   ├── auto-changelog.service.ts   # AI-powered changelog generation + locking
│   └── changelog.service.ts        # Changelog CRUD + unpublish/delete
├── routes/
│   ├── webhook.route.ts            # POST /webhooks/github
│   └── github.route.ts             # /api/github/* routes
└── middleware/
    └── verify-github-webhook.middleware.ts  # HMAC signature verification
```

### Database Relationships

```text
Product
├── ProductRepository (one-to-many)
│   └── GitHubRelease (one-to-many)
├── ChangelogEntry (one-to-many)
│   ├── source: 'manual' | 'automated'
│   └── createdBy → User
└── AutoChangelogLock (one-to-one)
```

## Testing

See [Webhook Testing](webhook-testing.md) for instructions on testing the webhook endpoint with curl and real GitHub events.
