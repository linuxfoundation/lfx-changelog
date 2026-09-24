<!-- Copyright The Linux Foundation and each contributor to LFX. -->
<!-- SPDX-License-Identifier: MIT -->

# GitHub Integration

The LFX Changelog integrates with GitHub through a **GitHub App** to track repositories, sync releases, and automatically generate changelog entries from merged pull requests and commits. This document covers the full integration: GitHub App setup, repository tracking, release syncing, webhook processing, and AI-powered changelog generation.

## Overview

| Component               | Description                                                                   |
| ----------------------- | ----------------------------------------------------------------------------- |
| **GitHub App**          | Authenticates with GitHub on behalf of installed organizations                |
| **Repository tracking** | Links GitHub repos to LFX products via the admin UI                           |
| **Release sync**        | Stores GitHub release metadata in the database (manual sync + webhooks)       |
| **Webhook endpoint**    | Receives GitHub events (releases, pushes, merged PRs, workflow runs and jobs) |
| **Release jobs**        | Follows a released tag through the repository's CI to success or failure      |
| **Automated changelog** | AI generates draft changelog entries from GitHub activity                     |
| **Author reassignment** | Super admins can reassign changelog authorship to any user                    |

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

## Creating Releases

Releases can be published from the admin UI, which creates them on GitHub. The tag is created as a side effect at the chosen branch or commit, so this is the only place the application writes a git ref --- **the GitHub App requires `Contents: write`**, and it is the only write permission the app uses. Everything else in this integration is read-only.

The release row itself is not written by the create call --- the `release.published` webhook stores it exactly as it would for a release created on github.com. The one thing the create call does persist is the release job, because GitHub credits the App rather than a person when Changelog publishes, so the webhook has no way to learn who asked. See [Release Jobs](#release-jobs).

| Method | Path                                              | Auth                       | Description                               |
| ------ | ------------------------------------------------- | -------------------------- | ----------------------------------------- |
| GET    | `/api/github/repositories/:repoId/release-target` | OAuth only (product_admin) | Branches, default branch, suggested tag   |
| GET    | `/api/github/repositories/:repoId/changes`        | OAuth only (product_admin) | Commits and merges since the last release |
| POST   | `/api/github/repositories/:repoId/release-notes`  | OAuth only (product_admin) | Preview GitHub-generated notes            |
| POST   | `/api/github/repositories/:repoId/releases`       | OAuth only (product_admin) | Publish the release                       |

Authorization is per repository: the caller must hold `product_admin` (or higher) on the product that owns it. The route applies the global role check and the service then re-checks the product, so a repository outside the caller's products returns `404` rather than `403` --- the endpoints cannot be used to enumerate repositories. API keys are rejected; session authentication only.

`POST /api/github/repositories/:repoId/sync` is scoped the same way, so a product admin can refresh the releases of a repository they administer. The product-wide `POST /api/github/products/:productId/sync` remains `super_admin`.

Releases are always published, never drafted. A draft would fire GitHub's `created` event, which this application does not handle, so a drafted release would be invisible here until published.

Suggested tags come from the newest stored release for the repository, patch-bumped, preserving a leading `v` when the previous tag used one.

The tag is checked before publishing and an existing one is rejected with `409`. GitHub would otherwise accept the release and silently ignore `targetCommitish`, publishing at whatever commit the existing tag points to instead of the branch the author selected.

That check is not atomic, so the guarantee holds up to a race rather than absolutely. If a release for the tag appears between the check and the publish call, GitHub answers `422 already_exists` and that is reported as the same `409`. If only the _tag_ appears in that window, with no release attached, GitHub publishes against it and returns success --- the one case where the selected target is not the commit released. Closing it entirely would mean creating the ref first and cleaning it up when publishing fails; the window is a single request wide and has not been judged worth that.

### Failure modes

| GitHub response     | API response                   | Usual cause                                     |
| ------------------- | ------------------------------ | ----------------------------------------------- |
| 422 or none         | 409 `CONFLICT`                 | The tag already exists                          |
| 422                 | 422 `GITHUB_VALIDATION_FAILED` | Unknown target branch or commit                 |
| 403 / 401           | 403 `GITHUB_FORBIDDEN`         | The App lacks `Contents: write`, or repo access |
| 403 + limit headers | 503 `GITHUB_RATE_LIMITED`      | Rate limited; retryable, so not a 403           |
| 404                 | 404 `GITHUB_NOT_FOUND`         | The App cannot see the repository               |
| 5xx / no reply      | 502 `GITHUB_SERVICE_ERROR`     | GitHub is unavailable, or the token call failed |

GitHub answers `403` for rate limits as well as permission failures, so a response carrying `x-ratelimit-remaining: 0` or `retry-after` is classified as the transient case rather than reported as a permissions problem.

These statuses apply to the three endpoints above. The older read and sync methods on `GitHubService` predate this mapping and still surface upstream failures as `500`.

GitHub's own error text is recorded in the server logs but never returned to the caller.

## Release Syncing

GitHub releases are stored in the database and displayed on the admin repositories page and on a product's Repositories tab. On both, the release count opens that repository's release history. Releases sync via two mechanisms:

### 1. Webhook-Driven (Real-Time)

When a `release` event arrives via webhook, the release is upserted or deleted immediately. See [Webhook Processing](#webhook-processing) below.

### 2. Manual Full Sync

Triggered from the admin UI for a specific product. Fetches up to 100 releases per repository via the GitHub API and upserts them all.

### Release Data Model

Each synced release is stored as a **GitHubRelease** record linked to a ProductRepository. Key fields include GitHub's release ID, tag name, release name, HTML URL, markdown body (release notes), draft/prerelease flags, publish date, and author info (login + avatar URL). Releases are uniquely constrained per repository + GitHub ID and indexed by publish date for efficient ordering.

## Release Jobs

Publishing a release is where Changelog's involvement in a deployment ends. The tag is what the
repository's own CI reacts to: in `lfx-self-serve`, for example, `docker-build-tag.yml` runs on
`v*` tags, builds and signs the image and chart, and then dispatches a version-bump workflow in
`lfx-v2-argocd` using its own App credentials. Changelog neither opens that pull request nor has
access to that repository.

What Changelog does do is follow the run, so that publishing a release and finding out whether it
deployed are not two different places. A **ReleaseJob** records one attempt at releasing a service:
the tag that was published, the workflow run the repository started for it, and what that run did.

### Which repositories are followed

Only repositories with an active **ReleasableService** --- the catalog row that marks a tracked
repository as something that deploys. Most tracked repositories are documentation, examples or
libraries with no deployment of their own, and they never accrue release jobs. Retiring a service
by clearing `isActive` stops it accruing new ones.

### Lifecycle

| Stage        | Trigger                                                                                              | Result                                                         |
| ------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Opened       | Publishing from Changelog, or `release.published` for a repository with an active releasable service | A `pending` job for the tag                                    |
| Running      | `workflow_run` while the run is not yet `completed`                                                  | `running`, with the run's id, name and URL                     |
| Created late | `workflow_run` for a released tag that has no job yet                                                | The job is created directly in the run's state                 |
| Finished     | `workflow_run` with `status: completed`                                                              | `succeeded` if the conclusion is `success`, otherwise `failed` |
| Detailed     | `workflow_job` for a known run                                                                       | The job's latest state appended to `steps`, keyed by name      |

GitHub's conclusions are richer than those four states, so the raw `conclusion` is stored
alongside: a cancelled run is `failed` here but still reads `cancelled` in the record.

### Matching a run to a release

A run carries the tag in `head_branch` when it was triggered by a tag push, so only runs whose
`event` is `push` or `release` are considered — for anything else `head_branch` is a branch name,
and a pull request from a branch named like a tag is not that release's CI.

A run is recorded when the tag already has an open job, or when it has a published (non-draft)
release on a repository with an active releasable service. An open job matches even if the service
has since been retired, so retiring one mid-deploy does not strand the job already following it.

Both the publish endpoint and the webhook open jobs, and either may get there first — GitHub
dispatches the webhook independently of the publish request's own round-trip. Whichever creates
the row, the publish path writes the attribution, and the webhook passes none and so cannot clear
it. A tag pushed straight to GitHub is followed just the same, without one.

Deliveries for a single run are ordered by GitHub's `updated_at` for that run, which advances on
every state change: a redelivery is older and is refused, while a re-run reuses the id but is
newer and is allowed. The comparison is a condition on the write, so there is no window between
deciding and writing. A run with a different id supersedes the tag's previous one outright.

One GitHub repository can be tracked by several products, each with its own releasable service.
That is a job per product for the same tag, and the single workflow run reports to all of them ---
which is why the run id is indexed rather than unique.

### Required GitHub App configuration

| Setting            | Value           | Why                                   |
| ------------------ | --------------- | ------------------------------------- |
| Permission         | `Actions: read` | Reading workflow run and job payloads |
| Event subscription | `Workflow run`  | Run-level status                      |
| Event subscription | `Workflow job`  | Per-job progress within a run         |

Adding a permission to the App does not apply it to existing installations: **each organization
must approve the change before its events arrive**. Until then the webhook simply receives nothing
and release jobs stay `pending`.

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

| GitHub Event   | Actions Processed                               | Behavior                                                        |
| -------------- | ----------------------------------------------- | --------------------------------------------------------------- |
| `release`      | `published`, `edited`                           | Upserts the release in the database                             |
| `release`      | `deleted`                                       | Deletes the release from the database                           |
| `push`         | Any                                             | Triggers auto-changelog (only for pushes to default branch)     |
| `pull_request` | `closed` (with `merged: true`)                  | Triggers auto-changelog (only for PRs merged to default branch) |
| `workflow_run` | `requested`, `in_progress`, `completed`         | Records the run against the release job for its tag             |
| `workflow_job` | `queued`, `waiting`, `in_progress`, `completed` | Records that job's progress on the release job                  |

All other event types are acknowledged with `200 OK` and silently ignored.

The two workflow events return before the auto-changelog trigger. A deployment run says nothing
about the product's changelog, and the trigger map falls back to `webhook_push` for any event it
does not recognise, so without that early return a workflow event would run the agent.

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
  ├─ Is workflow_run / workflow_job event?
  │   ├─ YES: Record it on the release job, return 200 OK, and stop here
  │
  ├─ Is release event?
  │   ├─ YES: Upsert/delete GitHubRelease synchronously
  │   ├─ Open a release job when the action is `published`
  │   └─ Update ProductRepository.lastSyncedAt
  │
  ├─ Return 200 OK immediately
  │
  └─ ASYNC: Trigger auto-changelog generation per product (deduplicated)
```

## Automated Changelog Generation

When GitHub activity is detected via webhooks, the system asynchronously generates a draft changelog entry using the **Claude Agent SDK pipeline**. A Claude agent with scoped MCP tools analyzes GitHub activity and produces polished, user-focused release notes — all saved as drafts for human review.

For full details on the agent pipeline architecture, MCP tools, configuration, API endpoints, and troubleshooting, see [Changelog Agent Pipeline](changelog-agent.md).

### Trigger Points

Auto-changelog generation is triggered by:

- `release` events (published, created, edited)
- `push` events (to the default branch)
- `pull_request` events (merged to the default branch)

It can also be triggered manually via `POST /api/agent-jobs/trigger/:productId` (SUPER_ADMIN only).

### Distributed Lock

Multiple server replicas may receive webhooks simultaneously. A database-based distributed lock (**AutoChangelogLock**, keyed by product ID) prevents duplicate generation. Each lock tracks a status (`in_progress` or `pending_rerun`) and a `lockedAt` timestamp.

**Lock behavior:**

| Scenario               | Action                                                                          |
| ---------------------- | ------------------------------------------------------------------------------- |
| No lock exists         | Insert lock with `in_progress` --- generation begins                            |
| Lock exists (< 10 min) | Set status to `pending_rerun` --- generation will re-run after current finishes |
| Lock exists (> 10 min) | Reclaim stale lock (crashed replica recovery)                                   |

If `pending_rerun` is set during generation, the system re-runs once more after the current generation completes. This catches multiple rapid webhook events.

### Agent Pipeline Flow

```text
1. Create AgentJob record (status: pending)

2. Ensure bot user exists
   └─ email: changelog-bot@linuxfoundation.org
   └─ name: LFX Changelog Bot

3. Determine "since" date
   └─ Last published changelog's publishedAt (or createdAt)
   └─ Fallback: 30 days ago

4. Fetch GitHub activity (per repository)
   ├─ Commits since date (paginated)
   ├─ Merged PRs since date (paginated)
   └─ Stored GitHubRelease records since date

5. Build activity context (markdown-formatted)

6. Run Claude Agent SDK with 4 MCP tools:
   ├─ search_past_changelogs — tone matching
   ├─ create_changelog_draft — create new draft
   ├─ update_changelog_draft — update existing draft
   └─ get_latest_version — semver suggestion

7. Agent produces title + version + description
   └─ Saves as draft via MCP tool

8. Job marked completed with metrics
   └─ Token usage, turns, duration recorded
```

### Changelog Source Tracking

Each changelog entry has a `source` field: `manual` (created by a human) or `automated` (generated by the agent pipeline from GitHub activity).

Automated changelogs are created as **drafts** and must be reviewed and published by a human. The agent updates the same draft if the product already has an automated draft in progress, rather than creating duplicates.

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
│   ├── github.service.ts             # GitHub API client (JWT auth, API calls)
│   ├── release.service.ts            # Release CRUD + sync logic
│   ├── releasable-service.service.ts # The catalog of repositories that deploy
│   ├── release-job.service.ts        # Release jobs driven by workflow webhooks
│   ├── changelog-agent.service.ts    # AI-powered changelog generation + locking
│   └── changelog.service.ts          # Changelog CRUD + unpublish/delete
├── routes/
│   ├── webhook.route.ts              # POST /webhooks/github
│   └── github.route.ts               # /api/github/* routes
└── middleware/
    └── github-webhook.middleware.ts  # HMAC signature verification
```

### Database Relationships

```text
Product
├── ProductRepository (one-to-many)
│   ├── GitHubRelease (one-to-many)
│   └── ReleasableService (zero-or-one)
│       └── ReleaseJob (one-to-many)
├── ChangelogEntry (one-to-many)
│   ├── source: 'manual' | 'automated'
│   └── createdBy → User
└── AutoChangelogLock (one-to-one)
```

## Testing

See [Webhook Testing](webhook-testing.md) for instructions on testing the webhook endpoint with curl and real GitHub events.
