<!-- Copyright The Linux Foundation and each contributor to LFX. -->
<!-- SPDX-License-Identifier: MIT -->

# Changelog Agent Pipeline

The LFX Changelog uses a **Claude Agent SDK pipeline** to automatically generate changelog drafts from GitHub activity. When a webhook event arrives (push, release, merged PR), the server pre-fetches GitHub data, spins up a Claude agent with scoped MCP tools, and produces a polished draft changelog entry — all without human intervention.

## Overview

| Component              | Description                                                               |
| ---------------------- | ------------------------------------------------------------------------- |
| **Agent service**      | Orchestrates jobs: pre-fetches data, runs the agent, records metrics      |
| **MCP tools**          | 4 scoped tools the agent can call (search, create, update, get version)   |
| **Agent job tracking** | Database records with status, progress log, token usage, and duration     |
| **API endpoints**      | List jobs, get job details, manually trigger a run (SUPER_ADMIN only)     |
| **Webhook triggers**   | Automatically triggered by push, release, and merged PR webhook events    |

## Architecture

```text
GitHub Webhook
  │
  ├─ Verify HMAC signature
  ├─ Process release events (upsert/delete)
  ├─ Return 200 OK immediately
  │
  └─ ASYNC: ChangelogAgentService.runAgentForProduct(productId, trigger)
       │
       ├─ 0. Acquire distributed lock (AutoChangelogLock)
       │     └─ If locked: mark pending_rerun, return existing job ID
       ├─ 1. Create AgentJob record (status: pending)
       ├─ 2. Ensure bot user exists (changelog-bot@linuxfoundation.org)
       ├─ 3. Determine "since" date (last published changelog or 30-day fallback)
       ├─ 4. Fetch linked repositories
       ├─ 5. Gather GitHub activity (commits, merged PRs, stored releases)
       ├─ 6. Build activity context (markdown-formatted)
       ├─ 7. Build user prompt with product info + activity
       ├─ 8. Create MCP server with 4 tools
       ├─ 9. Derive ANTHROPIC_BASE_URL/ANTHROPIC_API_KEY from LiteLLM config
       └─ 10. Run Claude Agent SDK query
             │
             ├─ Agent reads activity context
             ├─ Agent calls search_past_changelogs (tone matching)
             ├─ Agent calls get_latest_version (semver)
             ├─ Agent generates title + description
             ├─ Agent calls create_changelog_draft or update_changelog_draft
             └─ Job marked completed with metrics (tokens, turns, duration)
       │
       └─ Check AutoChangelogLock for pending_rerun
             ├─ If pending_rerun: create new job, run once more with fresh data
             └─ Release lock
```

## MCP Tools

The agent operates in a sandboxed environment with only these 4 tools available:

| Tool                      | Description                                                              |
| ------------------------- | ------------------------------------------------------------------------ |
| `search_past_changelogs`  | Returns up to 10 recent published entries for tone and style matching    |
| `create_changelog_draft`  | Creates a new automated draft (title ≤ 60 chars, version, description)  |
| `update_changelog_draft`  | Updates an existing automated draft by ID                                |
| `get_latest_version`      | Returns the latest version string and suggests the next patch version    |

All tools operate on the specific product being processed. The agent cannot access other products, publish entries, or call external APIs.

## Agent System Prompt

The agent follows a structured workflow:

1. **ANALYZE** the provided GitHub activity data (commits, PRs, releases)
2. **SEARCH** past changelogs via `search_past_changelogs` to match tone and style
3. **GENERATE** a changelog entry with:
   - Title: max 60 characters, title case, theme-focused
   - Version: clean semver (from release tag or bumped via `get_latest_version`)
   - Description: 50–150 words of markdown with `##` headings and bullet points
4. **VALIDATE** output (no repo names, PR numbers, commit SHAs, or GitHub usernames)
5. **SAVE** via `create_changelog_draft` or `update_changelog_draft`

Rules enforced by the prompt:
- Always saves as **draft** — never publishes directly
- Writes in third person present tense ("Adds support for...", "Fixes an issue where...")
- Omits internal tooling, CI/CD, and developer-facing details unless they affect end users
- Trivial activity (dependency bumps, typo fixes) still produces a concise entry

## Agent Configuration

Defined in `src/server/constants/agent.constants.ts`:

| Setting       | Value               | Description                                   |
| ------------- | ------------------- | --------------------------------------------- |
| `MAX_TURNS`   | 15                  | Maximum agent turns before forced stop         |
| `MODEL`       | `claude-sonnet-4-6` | Claude model used for generation               |
| `TIMEOUT_MS`  | 180,000 (3 min)     | AbortController timeout for the agent query    |

## Environment Variables

| Variable          | Required | Description                                                              |
| ----------------- | -------- | ------------------------------------------------------------------------ |
| `AI_API_URL`      | Yes      | LiteLLM proxy URL (e.g. `https://proxy.example.com/chat/completions`)   |
| `LITELLM_API_KEY` | Yes      | API key for the LiteLLM proxy                                            |

These are derived at runtime into `ANTHROPIC_BASE_URL` (with `/chat/completions` stripped) and `ANTHROPIC_API_KEY` for the Claude Agent SDK.

### Allowlisted Environment Variables

Only these env vars are passed to the agent subprocess:

- `PATH` — system path for tool execution
- `HOME` — home directory
- `NODE_EXTRA_CA_CERTS` — custom CA certificates (if set)
- `ANTHROPIC_BASE_URL` — derived from `AI_API_URL`
- `ANTHROPIC_API_KEY` — derived from `LITELLM_API_KEY`

## API Endpoints

All endpoints require authentication and **SUPER_ADMIN** role.

| Method | Path                                 | Response | Description                    |
| ------ | ------------------------------------ | -------- | ------------------------------ |
| GET    | `/api/agent-jobs`                    | 200      | Paginated list of agent jobs   |
| GET    | `/api/agent-jobs/:id`                | 200      | Single job with progress log   |
| POST   | `/api/agent-jobs/trigger/:productId` | 202      | Manually trigger an agent run  |

### GET /api/agent-jobs

Query parameters:

| Parameter   | Type   | Description                                           |
| ----------- | ------ | ----------------------------------------------------- |
| `productId` | UUID   | Filter by product ID                                  |
| `status`    | string | Filter by status (`pending`, `running`, `completed`, `failed`) |
| `page`      | number | Page number (default: 1)                              |
| `limit`     | number | Items per page (default: 20, max: 100)                |

Response: `{ success, data, total, page, pageSize, totalPages }`

### GET /api/agent-jobs/:id

Returns a single job with full `progressLog` array and linked `product` and `changelogEntry` (if created).

### POST /api/agent-jobs/trigger/:productId

Returns `202 Accepted` with `{ success: true, data: { jobId: "<uuid>" } }`. The agent runs asynchronously — poll `GET /api/agent-jobs/:id` to track progress.

## Data Model

### AgentJob (Prisma)

| Field            | Type              | Description                                          |
| ---------------- | ----------------- | ---------------------------------------------------- |
| `id`             | UUID              | Primary key                                          |
| `productId`      | UUID (FK)         | Product this job runs for                            |
| `trigger`        | AgentJobTrigger   | `webhook_push`, `webhook_release`, `webhook_pull_request`, `manual` |
| `status`         | AgentJobStatus    | `pending`, `running`, `completed`, `failed`          |
| `changelogId`    | UUID? (FK)        | Linked changelog entry if one was created/updated    |
| `promptTokens`   | Int?              | Input tokens consumed                                |
| `outputTokens`   | Int?              | Output tokens consumed                               |
| `durationMs`     | Int?              | Total execution time in milliseconds                 |
| `numTurns`       | Int?              | Number of agent turns                                |
| `progressLog`    | JSON              | Array of `ProgressLogEntry` objects                  |
| `errorMessage`   | String?           | Error details if job failed                          |
| `createdAt`      | DateTime          | When the job was created                             |
| `startedAt`      | DateTime?         | When execution began                                 |
| `completedAt`    | DateTime?         | When execution finished                              |

### ProgressLogEntry

```typescript
type ProgressLogEntry = {
  timestamp: string;  // ISO 8601
  type: 'tool_call' | 'tool_result' | 'text' | 'error';
  tool?: string;      // Name of MCP tool called
  summary: string;    // ≤200 chars for text, full message for errors
};
```

## Bot User

All automated changelogs are attributed to a dedicated bot user:

- **Email:** `changelog-bot@linuxfoundation.org`
- **Name:** LFX Changelog Bot
- Created on-demand via `upsert` if it doesn't exist

## Concurrency (Rerun-Once)

The `AutoChangelogLock` table prevents duplicate agent runs and ensures no webhook activity is missed. When a webhook arrives while an agent job is already running for the same product, the system marks the lock as `pending_rerun` instead of starting a second concurrent job.

| Scenario               | Action                                                                |
| ---------------------- | --------------------------------------------------------------------- |
| No lock exists         | Acquire lock, create job, run agent                                   |
| Lock exists (< 10 min) | Mark `pending_rerun` — agent will re-run after current job finishes   |
| Lock exists (> 10 min) | Reclaim stale lock (crashed replica recovery)                         |

After an agent job completes, the service checks the lock:
- If `pending_rerun` is set, it creates a **new** job and runs once more with fresh GitHub data
- If not, it releases the lock

This guarantees that bursty webhooks (e.g., multiple pushes in quick succession) result in at most **two** agent runs — the original plus one follow-up that captures all activity that arrived during the first run.

## File Structure

```text
apps/lfx-changelog/src/server/
├── constants/
│   └── agent.constants.ts          # AGENT_CONFIG + AGENT_SYSTEM_PROMPT
├── controllers/
│   ├── agent-job.controller.ts     # REST endpoints (list, get, trigger)
│   └── webhook.controller.ts       # Webhook → agent trigger
├── helpers/
│   └── activity-context.helper.ts  # Builds markdown activity context
├── services/
│   └── changelog-agent.service.ts  # Core agent execution + MCP tools
├── routes/
│   └── agent-job.route.ts          # Route registration (SUPER_ADMIN)
└── swagger/
    └── paths/
        └── agent-jobs.path.ts      # OpenAPI definitions
```

## Troubleshooting

### Agent job stays in `pending` or `running`

- Check `AI_API_URL` and `LITELLM_API_KEY` are set correctly
- Verify the LiteLLM proxy is reachable from the server
- Check server logs for `Agent job execution failed unexpectedly`
- Jobs have a 3-minute timeout — stuck jobs will eventually fail

### Agent creates empty or poor-quality changelogs

- Ensure the product has linked GitHub repositories with recent activity
- Check that the GitHub App has access to the repositories
- Review the `progressLog` in the job detail to see what tools the agent called

### No agent job is created on webhook

- Verify `GITHUB_WEBHOOK_SECRET` matches the GitHub App configuration
- Check that the repository is tracked by a product in the `ProductRepository` table
- For `pull_request` events, ensure the PR was merged to the default branch
