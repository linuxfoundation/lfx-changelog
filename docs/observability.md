<!-- Copyright The Linux Foundation and each contributor to LFX. -->
<!-- SPDX-License-Identifier: MIT -->

# Observability

The LFX Changelog uses Datadog for application performance monitoring (APM), Real User Monitoring (RUM), session replay, and structured logging for request tracing.

## Datadog APM (Server-Side)

### Setup

Datadog APM is initialized via `dd-trace` at application startup. It **only activates in production** (`NODE_ENV === 'production'`).

**File:** `src/server/setup/tracer.ts`

```typescript
tracer.init({
  service: 'lfx-changelog',
  logInjection: true, // Injects trace context into log lines
  runtimeMetrics: true, // Collects Node.js runtime metrics
});
```

### What It Traces

- HTTP requests (Express middleware)
- PostgreSQL queries (via Prisma)
- External HTTP calls (GitHub API, LiteLLM, Slack API)
- Node.js runtime metrics (event loop lag, GC, heap usage)

### Log Correlation

With `logInjection: true`, every Pino log line includes Datadog trace and span IDs. This allows clicking from a log entry in Datadog Logs directly to the associated APM trace.

### Known Limitation

The `fetch` instrumentation is **disabled** (`tracer.use('fetch', false)`) because Angular SSR's `FetchBackend` forwards browser cookies as headers. Non-ASCII characters in cookies (from URL-decoded values) violate the ByteString constraint and crash the request. Disabling fetch instrumentation prevents this.

## Datadog RUM (Client-Side)

### RUM Setup

Real User Monitoring tracks browser performance, user interactions, and errors. It's configured as an Angular app initializer that runs only in the browser (SSR-safe).

**File:** `src/app/shared/providers/datadog-rum/datadog-rum.provider.ts`

### Configuration

| Setting                   | Development | Production | Description                        |
| ------------------------- | ----------- | ---------- | ---------------------------------- |
| `sessionSampleRate`       | 0%          | 100%       | Percentage of sessions to track    |
| `sessionReplaySampleRate` | 0%          | 100%       | Percentage of sessions with replay |
| `trackUserInteractions`   | ---         | Yes        | Tracks clicks, inputs, navigation  |
| `trackResources`          | ---         | Yes        | Tracks XHR/fetch requests          |
| `trackLongTasks`          | ---         | Yes        | Tracks long-running JavaScript     |
| `allowedTracingUrls`      | ---         | API URL    | Forwards trace context to backend  |

In development, both sample rates are set to 0% so no data is sent to Datadog. In production, 100% of sessions are captured including full session replay.

### User Identity

When a user logs in, the `DatadogRumService` sets the user identity on the RUM session:

```typescript
datadogRum.setUser({
  id: user.sub, // Auth0 unique ID
  name: user.name,
  email: user.email,
});
```

This is cleared on logout. Allows filtering RUM sessions by specific users in the Datadog dashboard.

### Session Replay

Session replay captures a DOM-level recording of user sessions. This is useful for:

- Debugging reported UI issues
- Understanding user behavior
- Investigating error reports with full visual context

Replay recordings are available in the Datadog RUM dashboard alongside performance data.

## HTTP Request Logging

### Format

Every HTTP request is logged with method, URL, status code, and duration:

```text
GET /api/changelogs/abc123 200 45ms
POST /api/products 201 123ms
PATCH /api/changelogs/xyz/publish 200 78ms
GET /api/changelogs/notfound 404 - Not found error
```

### Structured JSON (Production)

In production, logs are emitted as JSON for ingestion by Datadog, ELK, or other log aggregators:

```json
{
  "level": "INFO",
  "time": "2026-03-04T12:34:56.789Z",
  "service": "lfx-changelog",
  "environment": "production",
  "req": {
    "id": "req-uuid",
    "method": "GET",
    "url": "/api/changelogs?productId=abc&page=1",
    "remoteAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0..."
  },
  "res": {
    "statusCode": 200
  },
  "responseTime": 45
}
```

### Pretty Printing (Development)

In development, logs are pretty-printed with colors for readability.

### Privacy

The request serializer intentionally excludes sensitive data:

| Included      | Excluded                                           |
| ------------- | -------------------------------------------------- |
| Request ID    | Request body                                       |
| HTTP method   | Cookies                                            |
| URL + query   | Authorization headers                              |
| Client IP     | Response headers (may contain set-cookie with JWT) |
| User-Agent    | Request headers (beyond user-agent)                |
| Status code   |                                                    |
| Response time |                                                    |

### Noise Filtering

These paths are excluded from request logging:

| Path        | Reason                                     |
| ----------- | ------------------------------------------ |
| `/health`   | Health check endpoint (frequent, no value) |
| `/assets/*` | Static assets (CSS, JS, images, fonts)     |

### Log Level

| Variable    | Default | Description                                     |
| ----------- | ------- | ----------------------------------------------- |
| `LOG_LEVEL` | `info`  | Logging level: `debug`, `info`, `warn`, `error` |

## Changelog Slugs (Pretty URLs)

Published changelog entries support human-readable URL slugs for better shareability and SEO.

### URL Format

```text
https://changelog.lfx.dev/entry/organization-dashboard-new-ui-launch
```

Falls back to UUID if no slug is set:

```text
https://changelog.lfx.dev/entry/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Slug Generation

Slugs are auto-generated from the product slug and changelog title:

```text
{product-slug}-{title-slug}
```

Example: Product "Organization Dashboard" + title "New UI Launch" becomes `organization-dashboard-new-ui-launch`.

**Generation rules:**

- Lowercase all characters
- Replace non-alphanumeric characters with hyphens
- Collapse consecutive hyphens
- Remove leading/trailing hyphens
- Unique constraint in the database (no duplicate slugs)

### Auto-Generation Behavior

| Scenario          | Behavior                                          |
| ----------------- | ------------------------------------------------- |
| New entry         | Slug auto-generated as user types the title       |
| Existing entry    | Slug preserved (not overwritten on title changes) |
| Manual edit       | User can manually change the slug in the editor   |
| Regenerate button | Regenerates the slug from the current title       |

### API Lookup

The public changelog detail endpoint accepts either a UUID or slug:

```text
GET /public/api/changelogs/organization-dashboard-new-ui-launch
GET /public/api/changelogs/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

Both resolve to the same entry. Slug lookup is case-insensitive.

## Environment Variables

### Datadog

| Variable                     | Required | Description                               |
| ---------------------------- | -------- | ----------------------------------------- |
| `DD_AGENT_HOST`              | No       | Datadog agent host (auto-detected in K8s) |
| `DATADOG_RUM_APPLICATION_ID` | No       | RUM application ID                        |
| `DATADOG_RUM_CLIENT_ID`      | No       | RUM client token                          |

RUM variables are injected into the Angular app at build time via the runtime config. If not set, RUM is disabled.

### Logging

| Variable    | Default | Description                  |
| ----------- | ------- | ---------------------------- |
| `LOG_LEVEL` | `info`  | Server-side logging level    |
| `NODE_ENV`  | ---     | Controls pretty vs JSON logs |

## Architecture

```text
apps/lfx-changelog/src/
├── server/
│   ├── setup/
│   │   ├── tracer.ts                  # dd-trace initialization (production only)
│   │   └── logger.ts                  # pino-http middleware setup
│   └── server-logger.ts               # Pino logger with custom serializers
└── app/
    └── shared/
        ├── providers/
        │   └── datadog-rum/
        │       └── datadog-rum.provider.ts  # RUM app initializer
        ├── services/
        │   └── datadog-rum/
        │       └── datadog-rum.service.ts   # User identity management
        └── utils/
            └── slugify.ts                   # Slug generation utility
```
