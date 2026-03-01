<!-- Copyright The Linux Foundation and each contributor to LFX. -->
<!-- SPDX-License-Identifier: MIT -->

# AI Chat

The LFX Changelog includes a conversational AI assistant that answers natural-language questions about changelog data. Users can ask things like "What changed in EasyCLA this month?" or "Summarize the latest security updates" and receive streaming, markdown-formatted responses grounded in real data.

The assistant uses an **agentic tool-calling loop** — it can query products and changelogs through internal tools, reason about the results, and compose an answer. Responses stream token-by-token via Server-Sent Events (SSE).

## Access Levels

Chat operates at two access levels, each with its own system prompt, tool set, and data visibility:

| Level    | Who                                   | Data Access                  | Route         |
| -------- | ------------------------------------- | ---------------------------- | ------------- |
| `public` | Anyone (no login required)            | Published changelogs only    | `/chat`       |
| `admin`  | Editors, Product Admins, Super Admins | Published + draft changelogs | `/admin/chat` |

Access level is determined automatically from the user's role assignments. Any user with an EDITOR, PRODUCT_ADMIN, or SUPER_ADMIN role gets `admin` access. All other authenticated users and anonymous visitors get `public` access.

## How It Works

### Agentic Tool-Calling Loop

The backend implements an agentic loop that allows the AI to make multiple tool calls before producing a final answer:

```text
User message
    │
    ▼
┌─────────────────────────────────────────────┐
│  1. Prepend system prompt                   │
│  2. Send messages + tool definitions        │
│     to LiteLLM (non-streaming)              │
│  3. Response has tool_calls?                │
│     ├─ YES → Execute tools, append results, │
│     │        loop back to step 2            │
│     │        (up to 10 iterations)          │
│     └─ NO  → Stream final text response     │
│              via SSE (token-by-token)       │
└─────────────────────────────────────────────┘
```

Intermediate tool-calling rounds use **non-streaming** requests (the full response is needed to extract tool call arguments). Only the final text answer is **streamed** to the client.

### Available Tools

The AI has access to three tools that call existing backend services directly (no HTTP round-trips):

| Tool                   | Description                                       | Public         | Admin                             |
| ---------------------- | ------------------------------------------------- | -------------- | --------------------------------- |
| `list_products`        | Lists all products with IDs, names, and slugs     | Active only    | All (including inactive)          |
| `search_changelogs`    | Searches changelogs with optional filters         | Published only | Published + drafts, status filter |
| `get_changelog_detail` | Gets the full content of a single changelog entry | Published only | Published + drafts                |

Tools call `ProductService` and `ChangelogService` directly rather than going through the HTTP API. This avoids unnecessary network hops and authentication overhead.

### Conversation Persistence

Conversations and messages are stored in PostgreSQL via two tables:

- **`chat_conversations`** — conversation metadata (title, access level, owner)
- **`chat_messages`** — individual messages including tool calls and tool results

This allows users to resume previous conversations from the sidebar. The context window is capped at the most recent 50 messages per conversation.

## API Endpoints

### Public (No Authentication)

| Method | Path                                 | Description                           |
| ------ | ------------------------------------ | ------------------------------------- |
| POST   | `/public/api/chat/send`              | Send a message and receive SSE stream |
| GET    | `/public/api/chat/conversations/:id` | Get a public conversation by ID       |

### Protected (Authentication Required)

| Method | Path                          | Description                                |
| ------ | ----------------------------- | ------------------------------------------ |
| POST   | `/api/chat/send`              | Send an authenticated message (SSE stream) |
| GET    | `/api/chat/conversations`     | List the current user's conversations      |
| GET    | `/api/chat/conversations/:id` | Get a conversation by ID                   |
| DELETE | `/api/chat/conversations/:id` | Delete a conversation                      |

### SSE Event Types

The streaming endpoints (`POST /send`) return Server-Sent Events with the following event types:

| Event             | Data          | Description                                            |
| ----------------- | ------------- | ------------------------------------------------------ |
| `conversation_id` | UUID string   | Emitted once at the start with the conversation ID     |
| `status`          | Status text   | Progress updates during tool execution                 |
| `content`         | Text chunk    | Streamed token-by-token as the AI generates a response |
| `tool_call`       | Tool name     | Emitted when the AI invokes an internal tool           |
| `title`           | Title string  | Auto-generated conversation title (new conversations)  |
| `done`            | Empty string  | Signals the response is complete                       |
| `error`           | Error message | Signals an error occurred                              |

### Example: Sending a Message

```bash
# Public (no auth)
curl -N -X POST http://localhost:4204/public/api/chat/send \
  -H "Content-Type: application/json" \
  -d '{"message": "What products are available?"}'

# Authenticated (with session cookie)
curl -N -X POST http://localhost:4204/api/chat/send \
  -H "Content-Type: application/json" \
  -H "Cookie: appSession=<your_session_cookie>" \
  -d '{"message": "Show me draft changelogs for EasyCLA"}'

# Continue an existing conversation
curl -N -X POST http://localhost:4204/public/api/chat/send \
  -H "Content-Type: application/json" \
  -d '{"message": "Tell me more about the first one", "conversationId": "uuid-here"}'
```

The `-N` flag disables output buffering so SSE events appear in real-time.

### Example: SSE Response

```text
event: conversation_id
data: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

event: status
data: "Looking up products..."

event: tool_call
data: "list_products"

event: status
data: "Searching changelogs..."

event: tool_call
data: "search_changelogs"

event: content
data: "Here"

event: content
data: "'s what"

event: content
data: "'s been happening"

event: content
data: " with EasyCLA:\n\n"

event: title
data: "What products are available?"

event: done
data: ""
```

## Frontend

The chat UI is implemented as an Angular component at `src/app/modules/chat/chat-page/`. It's mounted at two routes:

- `/chat` — public chat (via `PublicChatComponent` wrapper)
- `/admin/chat` — admin chat (via `AdminChatComponent` wrapper)

Both wrappers use the shared `ChatPageComponent` with different `mode` inputs (`'public'` or `'admin'`).

### Key Features

- **Streaming animation** — responses render character-by-character using a `requestAnimationFrame` drain buffer for smooth display
- **Conversation sidebar** — authenticated users see their conversation history and can switch between or delete conversations
- **Markdown rendering** — assistant responses are rendered with the `lfx-markdown-renderer` component (supports tables, code blocks, lists, headings)
- **Suggested prompts** — empty state shows clickable prompt cards to help users get started
- **Auto-scroll** — message area scrolls to bottom on new content, with scroll-position awareness (stops auto-scrolling if the user scrolls up)
- **Abort** — users can stop a streaming response mid-generation

### Service Architecture

`ChatService` (`src/app/shared/services/chat/chat.service.ts`) manages all chat state:

- Uses native `fetch()` with `ReadableStream` for SSE consumption (not `EventSource`, which doesn't support POST)
- Conversation list is a reactive `toSignal()` pipeline triggered by a `Subject<void>`
- Character drain buffer produces smooth streaming at 2–8 characters per animation frame

## Architecture

### File Structure

```text
apps/lfx-changelog/src/
├── server/
│   ├── constants/
│   │   ├── chat.constants.ts          # System prompts, config (max tokens, temperature, etc.)
│   │   └── chat-tools.constants.ts    # OpenAI-compatible tool definitions (public + admin)
│   ├── controllers/
│   │   └── chat.controller.ts         # HTTP controller (SSE streaming, access control)
│   ├── interfaces/
│   │   └── chat.interface.ts          # FlushableResponse, StreamResult types
│   ├── routes/
│   │   ├── chat.route.ts              # Protected routes (/api/chat/*)
│   │   └── public-chat.route.ts       # Public routes (/public/api/chat/*)
│   └── services/
│       ├── chat-ai.service.ts         # Agentic loop + LiteLLM streaming
│       ├── chat-conversation.service.ts # Prisma CRUD for conversations
│       └── chat-tool-executor.service.ts # Routes tool calls to existing services
├── app/
│   ├── modules/chat/
│   │   ├── chat-page/                 # Main chat page component
│   │   └── chat-message/             # Individual message bubble component
│   ├── modules/public/public-chat/    # Public wrapper component
│   ├── modules/admin/admin-chat/      # Admin wrapper component
│   └── shared/
│       ├── services/chat/chat.service.ts  # Angular chat service (SSE + state)
│       ├── constants/chat.constants.ts    # UI copy (prompts, labels)
│       └── interfaces/chat.interface.ts   # ChatCopy interface

packages/shared/src/schemas/
└── chat.schema.ts                     # Zod schemas (ChatMessage, ChatConversation, SSE events, etc.)
```

### Database Schema

```prisma
model ChatConversation {
  id          String           @id @default(uuid())
  userId      String?          // null for anonymous public conversations
  title       String           @default("New conversation")
  accessLevel ChatAccessLevel  // 'public' or 'admin'
  createdAt   DateTime
  updatedAt   DateTime
  messages    ChatMessage[]
}

model ChatMessage {
  id             String   @id @default(uuid())
  conversationId String
  role           String   // 'user' | 'assistant' | 'system' | 'tool'
  content        String?  // nullable for tool_calls-only messages
  toolCalls      Json?    // OpenAI tool_call array
  toolCallId     String?  // for tool result messages
  toolName       String?  // for tool result messages
  createdAt      DateTime
}
```

## Configuration

### Environment Variables

| Variable          | Required | Description                                                      |
| ----------------- | -------- | ---------------------------------------------------------------- |
| `LITELLM_API_URL` | Yes      | URL of the LiteLLM proxy (e.g. `https://litellm.example.com/v1`) |
| `LITELLM_API_KEY` | Yes      | API key for the LiteLLM proxy                                    |

These are the same variables used by the existing AI changelog generation service. The chat feature reuses the same LiteLLM proxy connection.

### Tuning Parameters

Defined in `src/server/constants/chat.constants.ts`:

| Parameter                     | Default | Description                                        |
| ----------------------------- | ------- | -------------------------------------------------- |
| `MAX_TOKENS`                  | 4096    | Maximum tokens in the AI response                  |
| `TEMPERATURE`                 | 0.3     | Response creativity (lower = more focused)         |
| `STREAM_TIMEOUT_MS`           | 120,000 | Timeout for the streaming connection (2 minutes)   |
| `MAX_TOOL_ITERATIONS`         | 10      | Maximum agentic loop iterations before stopping    |
| `MAX_CONVERSATION_MESSAGES`   | 50      | Context window cap (oldest messages trimmed first) |
| `DESCRIPTION_TRUNCATE_LENGTH` | 300     | Changelog description truncation in search results |

## Security

### Conversation Access Control

- **Public conversations** (`accessLevel: 'public'`) — readable by anyone, writable by the creator or anonymous users
- **Admin conversations** (`accessLevel: 'admin'`) — only accessible by the authenticated owner
- Unauthenticated users cannot read or write to admin conversations
- Authenticated users cannot access conversations owned by other users
- The `POST /send` endpoint verifies access level compatibility when continuing an existing conversation

### Same-Origin Enforcement

Chat endpoints are **UI-only** — they are not part of the public API and cannot be called by external clients. A `sameOriginOnly` middleware (`src/server/middleware/same-origin.middleware.ts`) validates every request using three layered checks:

1. **`Sec-Fetch-Site` header** — set by modern browsers and cannot be spoofed by JavaScript. Only `same-origin` and `none` (direct navigation) are allowed.
2. **`Origin` header** — must match one of the allowed UI domains (`localhost:4204`, `changelog.dev.lfx.dev`, `changelog.lfx.dev`).
3. **`Referer` header** — fallback for GET requests where `Origin` may not be sent.

If none of these headers are present (e.g. curl without spoofing), the request is rejected with **403 Forbidden**.

Additionally, protected chat endpoints (`/api/chat/*`) **reject API key authentication** — only session/cookie auth (OAuth) is accepted. This prevents programmatic access even from clients that have valid API keys.

No CORS headers are added to chat responses, which means cross-origin browser requests are blocked by default.

### Input Validation

All incoming messages are validated via Zod middleware:

- `message` — required, 1–4000 characters
- `conversationId` — optional, must be a valid UUID if provided
