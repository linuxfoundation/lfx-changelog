<!-- Copyright The Linux Foundation and each contributor to LFX. -->
<!-- SPDX-License-Identifier: MIT -->

# Public Product Roadmap

The LFX Changelog includes a public-facing product roadmap that displays ideas from Jira in a kanban board layout. Roadmap data is **fetched from Jira and cached server-side** (no database persistence) with a 5-minute TTL, so displayed data may lag behind Jira by several minutes.

## Overview

| Component          | Description                                                                |
| ------------------ | -------------------------------------------------------------------------- |
| **Data source**    | Jira Cloud API --- project `LFX`, issue type `Idea`                        |
| **Persistence**    | None --- in-memory cache with 5-minute TTL, stale fallback on Jira failure |
| **Columns**        | Now, Next, Later (active); Done, Won't do (completed, opt-in)              |
| **Privacy**        | Person names redacted to "First L." format before reaching the client      |
| **Authentication** | Public (no auth required) --- all endpoints under `/public/api/roadmap`    |

## How It Works

### Kanban Board

Users visit `/roadmap` to see a kanban board with three active columns (Now, Next, Later). Each column contains idea cards showing the summary, team/goal tags, and impact/effort/votes indicators.

- **Team filtering** --- pill buttons at the top filter ideas by team (e.g., "PCC", "Insights")
- **Show completed** --- a toggle reveals Done and Won't do columns
- **Detail panel** --- clicking a card opens a slide-in panel with full details, description (ADF rendered), comments, people, and a link to the Jira issue

### Mobile Behavior

On mobile (< 768px), columns render as a single-column accordion. Column headers are tappable to collapse/expand, with the first column expanded by default.

## Jira Integration

### Data Flow

```text
Jira Cloud API (JQL search)
    ↓ paginated fetch (all pages)
    ↓ field mapping (custom fields → RoadmapIdea)
    ↓ privacy redaction (names → "First L.")
    ↓ group by roadmapColumn
Server in-memory cache (5min TTL)
    ↓ HTTP Cache-Control headers
Angular client (HttpClient)
    ↓ reactive signals
Kanban board UI
```

### Caching Strategy

The server maintains two separate in-memory caches:

| Cache               | Contents                 | TTL   | Populated        |
| ------------------- | ------------------------ | ----- | ---------------- |
| **Active cache**    | Now, Next, Later columns | 5 min | On first request |
| **Completed cache** | Done, Won't do columns   | 5 min | Lazy (on demand) |

Both caches use a fetch-promise deduplication pattern --- concurrent requests share a single in-flight Jira API call. On Jira API failure, stale cache data is returned as a fallback.

HTTP cache headers are also set on responses:

| Endpoint     | `max-age` | `stale-while-revalidate` |
| ------------ | --------- | ------------------------ |
| Board & idea | 300s      | 60s                      |
| Comments     | 120s      | 30s                      |

### Security

- **Project isolation** --- Jira keys are validated against the pattern `/^LFX-\d+$/` to prevent fetching data from other Jira projects
- **Privacy redaction** --- person names (reporter, assignee, creator) are reduced to "First L." format before sending to the client
- **No auth required** --- all roadmap endpoints are public, but only expose curated Jira data (no raw Jira fields)

## API Endpoints

All endpoints are public (no authentication required).

| Method | Path                                    | Description                   |
| ------ | --------------------------------------- | ----------------------------- |
| GET    | `/public/api/roadmap`                   | Fetch the kanban board        |
| GET    | `/public/api/roadmap/:jiraKey`          | Fetch a single idea's details |
| GET    | `/public/api/roadmap/:jiraKey/comments` | Fetch comments for an idea    |

### Example Requests

```bash
# Fetch the kanban board
curl "https://changelog.lfx.dev/public/api/roadmap"

# Filter by team
curl "https://changelog.lfx.dev/public/api/roadmap?team=PCC"

# Include completed columns
curl "https://changelog.lfx.dev/public/api/roadmap?includeCompleted=true"

# Fetch a single idea
curl "https://changelog.lfx.dev/public/api/roadmap/LFX-123"

# Fetch comments for an idea
curl "https://changelog.lfx.dev/public/api/roadmap/LFX-123/comments"
```

### GET `/public/api/roadmap`

Returns the kanban board grouped by column.

**Query parameters:**

| Parameter          | Type      | Default | Description                             |
| ------------------ | --------- | ------- | --------------------------------------- |
| `team`             | `string?` | ---     | Filter ideas by team name (e.g., "PCC") |
| `includeCompleted` | `string?` | `false` | Include Done and Won't do columns       |

**Response:**

```json
{
  "success": true,
  "data": {
    "columns": {
      "Now": [{ "jiraKey": "LFX-123", "summary": "...", "teams": [...], ... }],
      "Next": [...],
      "Later": [...]
    },
    "teams": ["Insights", "PCC", "Security"],
    "lastFetchedAt": "2026-03-23T10:00:00.000Z"
  }
}
```

When `includeCompleted=true`, the `columns` object also includes `Done` and `Won't do` keys.

### GET `/public/api/roadmap/:jiraKey`

Returns a single idea with full details including description in ADF format.

**Path parameters:**

| Parameter | Type     | Description                      |
| --------- | -------- | -------------------------------- |
| `jiraKey` | `string` | Jira issue key (e.g., `LFX-123`) |

**Response:**

```json
{
  "success": true,
  "data": {
    "jiraKey": "LFX-123",
    "summary": "Feature title",
    "roadmapColumn": "Now",
    "teams": ["PCC"],
    "goals": ["Improve UX"],
    "category": "Enhancement",
    "value": 4,
    "effort": null,
    "impact": 5,
    "votes": 12,
    "status": "In Progress",
    "reporter": { "name": "John D.", "avatarUrl": "..." },
    "assignee": { "name": "Jane S.", "avatarUrl": "..." },
    "descriptionAdf": { ... },
    "jiraUrl": "https://...",
    "createdAt": "2026-01-15T...",
    "updatedAt": "2026-03-20T..."
  }
}
```

Returns `404` for non-existent keys or keys that don't match the `LFX-` prefix.

**Note:** This endpoint searches only the currently populated caches. Ideas in completed columns (Done, Won't do) are only available if the completed cache has been populated by a prior `GET /public/api/roadmap?includeCompleted=true` request. A direct lookup for a completed idea may return `404` if no one has requested completed columns since the last cache expiry.

### GET `/public/api/roadmap/:jiraKey/comments`

Returns Jira comments for an idea, ordered newest first (max 50).

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "author": { "name": "John D.", "avatarUrl": "..." },
      "bodyAdf": { ... },
      "createdAt": "2026-03-20T..."
    }
  ]
}
```

Returns an empty array for invalid or non-existent keys (does not 404).

## Data Model

Roadmap data is not persisted in the database --- it is fetched from Jira and cached in memory. See the Zod schemas in `packages/shared/src/schemas/roadmap.schema.ts` for exact field definitions.

- **RoadmapIdea** --- a single idea from the Jira roadmap board. Each idea has a Jira key (`LFX-123`), summary, kanban column (Now/Next/Later/Done/Won't do), team and goal tags, optional scoring fields (value, effort, impact --- all nullable, 0--5 when present), vote count, Jira workflow status, people (reporter, creator, assignee --- all nullable and privacy-redacted), an optional ADF description, and a Jira URL.

- **RoadmapPerson** --- a privacy-redacted person reference with a name in "First L." format and an optional avatar URL.

- **RoadmapComment** --- a Jira comment with a redacted author, ADF body, and creation timestamp.

## Frontend

The roadmap UI is implemented as a lazy-loaded Angular component at `src/app/modules/public/roadmap/`, mounted at the `/roadmap` route.

```text
RoadmapBoardComponent (main container)
├── Team filter pills
├── Show completed toggle
├── RoadmapColumnComponent x 3--5 (one per active/completed column)
│   └── RoadmapCardComponent x N (one per idea)
└── RoadmapDetailPanelComponent (slide-in panel, opened on card click)
```

- **Streaming updates** --- the board re-fetches automatically when filters (team, show completed) change
- **Parallel detail loading** --- idea details and comments load independently with separate loading states
- **ADF rendering** --- description and comments use `AdfToHtmlPipe` to render Atlassian Document Format as HTML

## Environment Variables

| Variable             | Required | Description                             |
| -------------------- | -------- | --------------------------------------- |
| `ATLASSIAN_EMAIL`    | Yes      | Email for Jira Cloud API basic auth     |
| `ATLASSIAN_API_KEY`  | Yes      | API token for Jira Cloud API basic auth |
| `ATLASSIAN_CLOUD_ID` | Yes      | Jira Cloud instance ID                  |

## Architecture

```text
packages/shared/src/
├── schemas/
│   └── roadmap.schema.ts              # Zod schemas (RoadmapIdea, RoadmapComment, etc.)
└── constants/
    └── roadmap.constant.ts            # Jira field IDs, column definitions, cache TTLs

apps/lfx-changelog/src/server/
├── controllers/
│   └── roadmap.controller.ts          # 3 route handlers (board, idea, comments)
├── services/
│   └── roadmap.service.ts             # Jira API sync, caching, field mapping, privacy
├── routes/
│   └── public-roadmap.route.ts        # Express routes with cache middleware
└── swagger/paths/
    └── public-roadmap.path.ts         # OpenAPI spec definitions

apps/lfx-changelog/src/app/
├── shared/services/
│   └── roadmap.service.ts             # Angular HttpClient wrapper
└── modules/public/roadmap/
    ├── roadmap-board/                 # Main board component (container)
    └── components/
        ├── roadmap-card/              # Individual idea card
        ├── roadmap-column/            # Column container (accordion on mobile)
        └── roadmap-detail-panel/      # Slide-in detail panel

apps/lfx-changelog/e2e/
├── pages/
│   └── roadmap-board.page.ts          # Playwright page object
└── specs/
    ├── public/
    │   └── roadmap-board.spec.ts      # UI tests (24 tests)
    └── api/
        └── public-roadmap.api.spec.ts # API contract tests (18 tests)
```
