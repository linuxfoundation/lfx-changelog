<!-- Copyright The Linux Foundation and each contributor to LFX. -->
<!-- SPDX-License-Identifier: MIT -->

# Contributors

The Contributors feature builds a directory of the people who write code in the tracked GitHub repositories and associates each of them with a Slack account. That association is what lets the platform address a real person — `<@U123ABC>` instead of `@octo-dev` — in automated Slack messages.

## Overview

| Component            | Description                                                                         |
| -------------------- | ----------------------------------------------------------------------------------- |
| **Contributor sync** | Pulls contributors from every tracked repository via the GitHub App                 |
| **Email enrichment** | Harvests git author emails from recent commits — the join key to Slack              |
| **Slack matching**   | Auto-links a contributor whose email matches a Slack workspace member               |
| **Manual linking**   | Admin UI picker for contributors the email match can't resolve                      |
| **Admin page**       | `/admin/contributors` — search, filter by product and link state, sync, link/unlink |

## Why email is the join key

GitHub's contributors endpoint returns a login, an avatar and a commit count — never an email. Slack's directory is keyed by email. Nothing else the two systems expose overlaps reliably: GitHub display names are free-form and frequently absent, and logins have no relationship to Slack handles.

So the sync harvests emails from the commit history instead. Every commit carries `commit.author.email`, and the GitHub App already has the `Contents: Read` permission that the commits endpoint needs.

Two caveats follow from this:

- **Contributors with no recent commits get no email.** The harvest window is the last 30 days (`DEFAULT_LOOKBACK_DAYS`). Someone who last contributed a year ago is still recorded, just without an email — link them manually.
- **`noreply` addresses never match.** Contributors with GitHub's email privacy enabled commit as `12345+login@users.noreply.github.com`. These are stored (they're still a valid identity signal) but skipped when matching against Slack and when choosing `primaryEmail`.

Manual linking is not a fallback for a broken auto-match — it is the expected path for a meaningful share of contributors.

## Data Model

Two tables, plus one enum.

**Contributor** — one row per GitHub account. Keyed on `github_user_id`, GitHub's immutable numeric ID, _not_ the login: logins change when people rename their accounts, and keying on one would silently create duplicates. The login is stored under a plain (non-unique) index and treated as mutable, refreshed on every sync — a unique index there would break the moment a login is renamed or reclaimed.

Each row holds the GitHub identity (login, avatar, profile URL), all discovered emails as a Postgres array plus a chosen `primary_email`, the Slack association (member ID, team, display and real name, avatar), and provenance for that association: `slack_link_source` (`auto_email` or `manual`), `slack_linked_at`, and `slack_linked_by_id`. Recording _how_ a link was made means a bad auto-match is auditable rather than indistinguishable from a human decision.

**ContributorRepository** — the join between a contributor and a `ProductRepository`, carrying the per-repository commit count and the date that repository was last active. These links are the source of truth: `Contributor.contributions` and `Contributor.lastActiveAt` are both derived from them by a single recalculation step, so an aggregate can never outlive the links it came from. This is what powers the product filter on the admin page. The contributor's top-level `contributions` is the sum across repositories, refreshed at the end of each sync.

## Sync

Triggered from the admin UI ("Sync from GitHub") or `POST /api/contributors/sync`. **Always scoped to one product or one repository** — exactly one of `productId` or `repositoryId` is required. An unscoped sync would crawl every tracked repository inline in the HTTP request and exceed proxy timeouts, so the endpoint refuses it, mirroring release sync (`POST /api/releases/sync/:productId`). On the admin page the sync button acts on the selected product and stays disabled until one is chosen.

```text
1. Load the tracked repositories for the given product (or the single repository)

2. Load the Slack workspace directory once, keyed by email
   └─ Unavailable? Record the error and continue without matching

3. Per repository (failures isolated — one bad repo does not abort the sync):
   ├─ GET /repos/{owner}/{repo}/contributors   (paginated, anonymous excluded)
   ├─ Harvest commit author emails from the last 30 days
   ├─ Upsert each contributor on github_user_id
   │   ├─ Merge newly discovered emails with those already stored
   │   ├─ Pick primary_email (first non-noreply address)
   │   └─ Auto-link Slack when the emails agree on one member and no link exists yet
   └─ Upsert the contributor↔repository row with its commit count

4. Roll per-repository counts up into Contributor.contributions
```

**Auto-linking never overwrites an existing association.** Once a contributor has a Slack user — whether matched automatically or set by a human — subsequent syncs leave it alone. Correcting a wrong link is an explicit unlink-then-relink.

## API Endpoints

All endpoints require an **OAuth session** and the **`super_admin`** role. API keys are rejected — these endpoints read the Slack workspace directory through the bot token.

| Method | Path                            | Description                                |
| ------ | ------------------------------- | ------------------------------------------ |
| GET    | `/api/contributors`             | Paginated list with filters                |
| GET    | `/api/contributors/slack-users` | Slack members matching a search term       |
| POST   | `/api/contributors/sync`        | Sync from GitHub                           |
| GET    | `/api/contributors/:id`         | Single contributor with their repositories |
| PUT    | `/api/contributors/:id/slack`   | Link to a Slack user                       |
| DELETE | `/api/contributors/:id/slack`   | Remove the Slack association               |
| DELETE | `/api/contributors/:id`         | Delete a contributor and its links         |

### List query parameters

| Param          | Description                                                         |
| -------------- | ------------------------------------------------------------------- |
| `query`        | Free-text across GitHub login, name, primary email, Slack real name |
| `productId`    | Only contributors who contributed to this product                   |
| `repositoryId` | Only contributors who contributed to this repository                |
| `slackLink`    | `linked` or `unlinked`                                              |
| `includeBots`  | Include bot accounts (excluded by default)                          |
| `page`         | Page number (default 1)                                             |
| `limit`        | Results per page (default 20, max 100)                              |

Bot accounts — `type: "Bot"` or a `[bot]` login suffix — are flagged on sync and hidden from the default view rather than discarded.

A Slack member can be linked to only one contributor; a second attempt returns `409 Conflict`.

## Privacy

Contributor records hold third-party PII — names and email addresses harvested from public commit metadata for people who never interacted with this system. Three deliberate constraints:

- **The Slack directory is never sent to the browser in full.** `GET /api/contributors/slack-users` requires a search term of at least two characters and filters server-side, returning at most 25 matches. Linking validates a single member through `users.info` rather than downloading the roster.
- **Search terms are kept out of logs.** Contributor search matches against email addresses, so `query` (along with `email` and `q`) is redacted from the request URL in both the log message and the structured `req.url` field — see `helpers/redact-url.helper.ts`.
- **No automatic link to LFX user accounts.** An earlier revision associated a contributor with the LFX `User` sharing an email. That was removed: commit-author email is attacker-controllable, and the link had no provenance or way to reverse it. Slack links, by contrast, record `slackLinkSource`, `slackLinkedAt` and `slackLinkedById`, and are reversible via `DELETE /api/contributors/:id/slack`.

`DELETE /api/contributors/:id` removes a contributor and its repository links, so an erasure request can be honoured. Because every field is derived from GitHub, deletion loses nothing authoritative — a later sync of a tracked repository recreates the record, which also means deletion is not a way to permanently suppress someone while their repository stays tracked.

There is no automatic retention or purge schedule. The application has no user-deletion or anonymisation flow anywhere, so a retention policy is worth addressing across the whole system rather than for contributors alone.

## Required Configuration

### GitHub App

No permission changes are required. The endpoints the sync uses are already covered by the permissions the app holds for release syncing and the changelog agent:

| Endpoint                                 | Permission     | Already granted                   |
| ---------------------------------------- | -------------- | --------------------------------- |
| `GET /repos/{owner}/{repo}/contributors` | Metadata: Read | Yes — mandatory for all apps      |
| `GET /repos/{owner}/{repo}/commits`      | Contents: Read | Yes — used by the changelog agent |

### Slack App

No scope changes are required. The bot installation already requests `users:read` and `users:read.email`, which is exactly what `users.list` needs to return members with their email addresses.

What _is_ required is that the **Slack bot is installed** — Admin → Settings → Connect Slack Bot. Without an active bot installation, contributor sync still works but records a "Slack directory unavailable" error and links nothing, and the manual picker shows an error.

## Architecture

```text
apps/lfx-changelog/src/server/
├── controllers/
│   └── contributor.controller.ts     # HTTP handlers
├── services/
│   ├── contributor.service.ts        # Sync, matching, linking, queries
│   ├── github.service.ts             # getRepositoryContributors()
│   └── slack.service.ts              # listWorkspaceUsers()
├── routes/
│   └── contributor.route.ts          # /api/contributors/*
└── swagger/paths/
    └── contributors.path.ts

apps/lfx-changelog/src/app/
├── modules/admin/
│   ├── contributors/                 # Admin page
│   └── components/link-slack-dialog/  # Slack picker dialog
└── shared/services/
    └── contributor.service.ts        # Angular HTTP wrapper
```

### Database Relationships

```text
Contributor
├── ContributorRepository (one-to-many)
│   └── ProductRepository → Product
├── user → User (optional, unique — the matching LFX account)
└── slackLinkedBy → User (who made a manual link)
```

## Related

- [GitHub Integration](github-integration.md) — GitHub App auth, repository tracking, webhooks
- [Slack Integration](slack-integration.md) — OAuth, token encryption, bot installation
