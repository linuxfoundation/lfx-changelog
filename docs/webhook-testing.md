# Webhook Testing

Guide for testing the GitHub webhook endpoint that receives release events and syncs them to the database.

## Overview

| Detail   | Value                                                                  |
| -------- | ---------------------------------------------------------------------- |
| Endpoint | `POST /webhooks/github`                                                |
| Auth     | HMAC-SHA256 signature via `X-Hub-Signature-256` header                 |
| Events   | `release` (published, created, edited, prereleased, released, deleted) |
| Ignored  | All other GitHub event types are acknowledged with `200 OK`            |

When a `release` event arrives for a repository tracked by a product (`ProductRepository`), the webhook upserts a `GitHubRelease` row. If the repository is not tracked, the event is silently ignored.

## Setup

Set `GITHUB_WEBHOOK_SECRET` in your `.env` file. This must match the secret configured in your GitHub App's webhook settings:

```bash
# apps/lfx-changelog/.env
GITHUB_WEBHOOK_SECRET=your-github-webhook-secret
```

## Manual Testing with curl

The script below sends a simulated `release` event to your local server. It computes the correct HMAC-SHA256 signature so the middleware accepts the request.

```bash
#!/usr/bin/env bash
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────
WEBHOOK_URL="http://localhost:4204/webhooks/github"
SECRET="your-github-webhook-secret"            # Must match GITHUB_WEBHOOK_SECRET in .env
REPO_FULL_NAME="linuxfoundation/lfx-changelog" # Use a repo tracked by a product

# ── Payload ───────────────────────────────────────────────────────────
PAYLOAD=$(cat <<'JSON'
{
  "action": "published",
  "release": {
    "id": 999001,
    "tag_name": "v1.0.0-test",
    "name": "Test Release v1.0.0",
    "html_url": "https://github.com/REPO_FULL_NAME/releases/tag/v1.0.0-test",
    "body": "## What's Changed\n\n- Added webhook testing guide\n- Fixed release sync\n",
    "draft": false,
    "prerelease": false,
    "published_at": "2026-03-02T12:00:00Z",
    "author": {
      "login": "test-user",
      "avatar_url": "https://avatars.githubusercontent.com/u/1?v=4"
    }
  },
  "repository": {
    "full_name": "REPO_FULL_NAME"
  }
}
JSON
)

# Replace placeholder with actual repo name
PAYLOAD="${PAYLOAD//REPO_FULL_NAME/$REPO_FULL_NAME}"

# ── Compute HMAC-SHA256 signature ─────────────────────────────────────
SIGNATURE="sha256=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $NF}')"

# ── Send request ──────────────────────────────────────────────────────
echo "Sending release webhook to $WEBHOOK_URL"
echo "Repository: $REPO_FULL_NAME"
echo "Signature:  $SIGNATURE"
echo ""

curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: release" \
  -H "X-Hub-Signature-256: $SIGNATURE" \
  -d "$PAYLOAD"
```

### Expected responses

**Tracked repository (release event):**

```json
{ "ok": true }
```

**Untracked repository (release event):**

```json
{ "ok": true, "ignored": true }
```

**Non-release event** (e.g., `X-GitHub-Event: push`):

```json
{ "ok": true, "ignored": true }
```

**Missing or invalid signature:**

```json
{ "error": "Missing signature" }        // 401
{ "error": "Invalid signature" }         // 401
```

**Secret not configured on server:**

```json
{ "error": "Webhook secret not configured" } // 500
```

## Testing with Real GitHub Webhooks

To receive real GitHub webhook deliveries on your local machine, use a tunnel service like [ngrok](https://ngrok.com/) or [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/).

### Steps

1. **Start the dev server:**

   ```bash
   yarn start
   ```

2. **Start a tunnel** (ngrok example):

   ```bash
   ngrok http 4204
   ```

   Note the forwarding URL (e.g., `https://abc123.ngrok-free.app`).

3. **Configure your GitHub App:**
   - Go to your GitHub App settings > Webhook
   - Set the webhook URL to `https://abc123.ngrok-free.app/webhooks/github`
   - Set the secret to match your `GITHUB_WEBHOOK_SECRET`
   - Subscribe to **Release** events

4. **Trigger a release** on a tracked repository (create/edit a release on GitHub).

5. **Verify** the webhook was received in your server logs and the release appears in the database (see [Verifying Results](#verifying-results)).

6. **Restore the webhook URL** in your GitHub App settings when done testing.

## Verifying Results

### Public API

Query the releases endpoint to see if the release was stored (requires authentication):

```bash
curl -s http://localhost:4204/api/releases \
  -H "Authorization: Bearer lfx_your-api-key" | jq '.data[:3]'
```

### Prisma Studio

Browse the `GitHubRelease` table directly:

```bash
yarn db:studio
```

### Server logs

Watch the server output for log lines like:

```text
INFO: Upserted release from webhook  repositoryId=... githubId=999001 tag=v1.0.0-test
INFO: GitHub webhook release event for untracked repository — ignoring  repoFullName=...
```

## Troubleshooting

| Symptom                       | Cause                                                                 | Fix                                                                        |
| ----------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `500` — secret not configured | `GITHUB_WEBHOOK_SECRET` is empty or missing in `.env`                 | Add the variable and restart the server                                    |
| `401` — missing signature     | Request has no `X-Hub-Signature-256` header                           | Ensure the curl script includes the `-H "X-Hub-Signature-256: ..."` header |
| `401` — invalid signature     | Secret mismatch between `.env` and the value used to sign the payload | Make sure both sides use the exact same secret string                      |
| `200` with `ignored: true`    | Repository `full_name` is not in the `ProductRepository` table        | Add the repo to a product via the admin UI or seed the database            |
| `200` with `ignored: true`    | Event type is not `release`                                           | Set `X-GitHub-Event: release` header                                       |
| `400` — empty body            | Request body is missing or not valid JSON                             | Ensure `-d "$PAYLOAD"` is included and the JSON is valid                   |
