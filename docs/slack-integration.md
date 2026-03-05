<!-- Copyright The Linux Foundation and each contributor to LFX. -->
<!-- SPDX-License-Identifier: MIT -->

# Slack Integration

The LFX Changelog integrates with Slack so users can share published changelog entries directly to Slack channels. The integration uses **OAuth 2.0 with token rotation** and encrypts all tokens at rest using AES-256-GCM.

## Overview

| Component         | Description                                                         |
| ----------------- | ------------------------------------------------------------------- |
| **OAuth flow**    | User-initiated Slack workspace connection with CSRF-protected state |
| **Token storage** | AES-256-GCM encrypted tokens with automatic refresh before expiry   |
| **Posting**       | Rich BlockKit messages posted as the connected user (not a bot)     |
| **Notifications** | Delivery tracking per changelog per channel                         |

## How It Works

### 1. Connect a Workspace

Users connect their Slack workspace from the admin settings:

1. Click **Connect Slack** in the admin UI
2. Redirected to Slack's OAuth authorize page
3. Select a workspace and approve the requested permissions
4. Redirected back to the app with an authorization code
5. Server exchanges the code for access + refresh tokens
6. Tokens are encrypted and stored in the database

### 2. Post a Changelog

After connecting, any published changelog can be shared to Slack:

1. Open a published changelog entry
2. Click **Post to Slack**
3. Select a workspace and channel from the dialog
4. Click **Post** --- the changelog is sent as a rich BlockKit message

## OAuth Flow

### Scopes

The integration requests **user token** scopes (not bot scopes):

| Scope           | Purpose                                           |
| --------------- | ------------------------------------------------- |
| `chat:write`    | Post messages to channels the user is a member of |
| `channels:read` | List public channels for the channel picker       |
| `groups:read`   | List private channels the user is a member of     |

Messages are posted **as the user**, not as a bot. This means the message appears under the user's name in Slack.

### CSRF Protection

The OAuth state parameter is signed with HMAC-SHA256 using `WEBHOOK_STATE_SECRET`:

1. A JSON payload is created containing the user ID and a timestamp: `{ userId, ts }`
2. The payload is serialized to a JSON string
3. An HMAC-SHA256 hex digest is computed over the JSON string
4. Both are wrapped into `{ d: <json-string>, s: <hmac-hex> }` and base64url-encoded

On callback, the server decodes the state, recomputes the HMAC over `d`, and compares with `s` using `crypto.timingSafeEqual()`. States older than 10 minutes are rejected.

### Token Rotation

Slack's token rotation is enabled, providing short-lived access tokens with automatic refresh:

| Token         | Lifetime   | Storage               |
| ------------- | ---------- | --------------------- |
| Access token  | 24 hours   | AES-256-GCM encrypted |
| Refresh token | Long-lived | AES-256-GCM encrypted |

The server automatically refreshes tokens **5 minutes before expiration** on every API call. If a refresh fails (token revoked, account inactive), the integration is marked as `revoked` and the user must reconnect.

### Token Encryption

Tokens are encrypted at rest using AES-256-GCM:

- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Key:** 32-byte key from `SLACK_TOKEN_ENCRYPTION_KEY` (64 hex characters)
- **IV:** Random 12 bytes per encryption
- **Storage format:** `base64url(iv):base64url(authTag):base64url(ciphertext)`

This ensures that even if the database is compromised, Slack tokens cannot be used without the encryption key.

## API Endpoints

| Method | Path                                   | Auth                           | Description                      |
| ------ | -------------------------------------- | ------------------------------ | -------------------------------- |
| GET    | `/api/slack/connect`                   | OAuth only                     | Generate Slack OAuth URL         |
| GET    | `/api/slack/integrations`              | OAuth only                     | List user's connected workspaces |
| GET    | `/api/slack/integrations/:id/channels` | OAuth only                     | Fetch channels for a workspace   |
| POST   | `/api/slack/integrations/:id/channels` | OAuth only                     | Save default channel             |
| DELETE | `/api/slack/integrations/:id`          | OAuth only                     | Disconnect a workspace           |
| POST   | `/api/changelogs/:id/share/slack`      | OAuth only (editor on product) | Post changelog to a channel      |
| GET    | `/webhooks/slack-callback`             | None                           | OAuth callback handler           |

All Slack endpoints are **OAuth-only** --- API keys cannot be used.

## Message Format

Changelog entries are posted as Slack **BlockKit** messages with the following structure:

```text
┌──────────────────────────────────────────────┐
│  📋  New Changelog: Feature Title            │  ← Header
├──────────────────────────────────────────────┤
│  Product: Organization Dashboard             │  ← Fields section
│  Version: 2.1.0                              │
├──────────────────────────────────────────────┤
│  Description preview text (up to 500 chars)  │  ← Description section
│  truncated if longer...                      │
├──────────────────────────────────────────────┤
│  [ View Full Changelog ]                     │  ← Action button (links to entry)
├──────────────────────────────────────────────┤
│  👤 John Doe · Posted via LFX Changelog      │  ← Context footer
└──────────────────────────────────────────────┘
```

The "View Full Changelog" button links to the entry's public URL using its slug (or ID if no slug is set).

## Data Model

The Slack integration uses three database tables (see the Prisma schema for exact field definitions):

- **SlackIntegration** --- stores the connection between a user and a Slack workspace. Each record holds the encrypted access and refresh tokens, token expiry, granted scopes, and status (`active` or `revoked`). Unique per user + workspace combination.

- **SlackChannel** --- tracks which channels a user has configured for posting within a workspace. One channel per workspace can be marked as the default. Unique per integration + channel ID combination.

- **SlackNotification** --- tracks delivery of each changelog post to a channel. Records the Slack message timestamp (for future updates), delivery status (`sent` or `failed`), and any error message. Unique per channel + changelog entry combination to prevent duplicate posts.

## Error Handling

| Scenario               | Behavior                                               |
| ---------------------- | ------------------------------------------------------ |
| Token expired          | Auto-refreshed 5 minutes before expiry                 |
| Refresh token revoked  | Integration marked as `revoked`, user must reconnect   |
| Invalid auth           | Integration marked as `revoked`                        |
| Account inactive       | Integration marked as `revoked`                        |
| Slack API rate limited | Auto-retry up to 3 times with exponential backoff      |
| Post fails             | Notification status set to `failed` with error message |
| OAuth state expired    | Callback rejected, user must restart the OAuth flow    |

## Environment Variables

| Variable                     | Required | Description                                          |
| ---------------------------- | -------- | ---------------------------------------------------- |
| `SLACK_CLIENT_ID`            | Yes      | Slack app OAuth client ID                            |
| `SLACK_CLIENT_SECRET`        | Yes      | Slack app OAuth client secret                        |
| `SLACK_TOKEN_ENCRYPTION_KEY` | Yes      | AES-256-GCM encryption key (64 hex chars = 32 bytes) |
| `WEBHOOK_STATE_SECRET`       | Yes      | HMAC-SHA256 secret for OAuth state CSRF protection   |

## Architecture

```text
apps/lfx-changelog/src/server/
├── controllers/
│   └── slack.controller.ts        # HTTP handlers for Slack endpoints
├── services/
│   └── slack.service.ts           # OAuth flow, token encryption, posting
├── routes/
│   └── slack.route.ts             # /api/slack/* route definitions

apps/lfx-changelog/src/app/
└── shared/
    ├── services/slack/
    │   └── slack.service.ts       # Angular HTTP wrapper
    └── components/
        └── post-to-slack-dialog/  # Channel picker + post dialog
```
