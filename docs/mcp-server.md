<!-- Copyright The Linux Foundation and each contributor to LFX. -->
<!-- SPDX-License-Identifier: MIT -->

# MCP Server

The LFX Changelog exposes its data to AI tools via the
[Model Context Protocol (MCP)](https://modelcontextprotocol.io/). Claude Desktop,
Claude Code, Cursor, and any other MCP-compatible client can list products, browse
changelogs, and fetch individual entries without screen-scraping or custom API
wrappers.

**Endpoint:** `https://changelog.lfx.dev/mcp` (Streamable HTTP, stateless)

## Quick Start

Point your MCP client at the production endpoint — no API key required.

### Claude Desktop

Add to your Claude Desktop config
(`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "lfx-changelog": {
      "type": "streamable-http",
      "url": "https://changelog.lfx.dev/mcp"
    }
  }
}
```

### Claude Code

Add to `.claude/settings.json` (project or global `~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "lfx-changelog": {
      "type": "streamable-http",
      "url": "https://changelog.lfx.dev/mcp"
    }
  }
}
```

### Cursor / Other MCP Clients

Any MCP-compatible client can connect using:

- **Transport:** Streamable HTTP
- **URL:** `https://changelog.lfx.dev/mcp`
- **Method:** `POST`

### curl

```bash
# Initialize handshake
curl -X POST https://changelog.lfx.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {},
      "clientInfo": { "name": "curl-test", "version": "1.0.0" }
    }
  }'
```

### MCP Inspector

The [MCP Inspector](https://github.com/modelcontextprotocol/inspector) can
connect for interactive testing:

```bash
npx @modelcontextprotocol/inspector --transport streamable-http --url https://changelog.lfx.dev/mcp
```

## Available Tools

Tools are callable actions that an AI client can invoke. All tools declare an
`outputSchema` so clients know the exact response shape — derived from the
Zod schemas in `@lfx-changelog/shared`.

| Tool              | Description                        | Parameters                                                  |
| ----------------- | ---------------------------------- | ----------------------------------------------------------- |
| `list-products`   | List all active LFX products       | _(none)_                                                    |
| `list-changelogs` | List published changelog entries   | `productId?` (UUID), `page?` (int), `limit?` (int, max 100) |
| `get-changelog`   | Get a single changelog entry by ID | `id` (UUID, required)                                       |

## Available Resources

Resources are read-only data endpoints that clients can subscribe to.

| URI                | Description                                     |
| ------------------ | ----------------------------------------------- |
| `lfx://products`   | All active products (JSON)                      |
| `lfx://changelogs` | Published changelogs across all products (JSON) |

## Environment Variables

These variables are only relevant when **self-hosting** or running the server
locally. The production endpoint at `changelog.lfx.dev` is pre-configured.

| Variable      | Default                 | Description                                                                                        |
| ------------- | ----------------------- | -------------------------------------------------------------------------------------------------- |
| `BASE_URL`    | `http://localhost:4204` | Base URL of the LFX Changelog API. Used by both stdio and HTTP transports to reach the public API. |
| `LFX_API_KEY` | _(none)_                | Bearer token for protected endpoints (future — not yet required).                                  |

## Local Development

The sections below are for contributors working on the MCP server package itself
(`packages/mcp-server`).

### Build

```bash
# Build the MCP server package
cd packages/mcp-server
yarn build

# Or build everything from the repo root
yarn build
```

### Watch mode

```bash
cd packages/mcp-server
yarn watch
```

### Connecting via stdio (local)

The stdio transport is useful for local development and debugging. It reads
`BASE_URL` to know where the local LFX Changelog API is running.

```bash
cd packages/mcp-server
BASE_URL=http://localhost:4204 yarn start
```

To connect Claude Desktop or Claude Code to a **local** instance via stdio:

```json
{
  "mcpServers": {
    "lfx-changelog-local": {
      "command": "node",
      "args": ["<path-to-repo>/packages/mcp-server/dist/index.js"],
      "env": {
        "BASE_URL": "http://localhost:4204"
      }
    }
  }
}
```

> **Tip:** Replace `<path-to-repo>` with the absolute path to your clone of
> `lfx-changelog`. Make sure you have built the package first (`yarn build`).

### Test with MCP Inspector

```bash
# stdio transport
npx @modelcontextprotocol/inspector node packages/mcp-server/dist/index.js

# HTTP transport (requires the dev server to be running)
npx @modelcontextprotocol/inspector --transport streamable-http --url http://localhost:4204/mcp
```

## Architecture

The implementation lives in `packages/mcp-server` and is published as the
workspace package `@lfx-changelog/mcp-server`.

```text
packages/mcp-server/
├── src/
│   ├── server.ts              # createMcpServer() factory — registers tools & resources
│   ├── index.ts               # stdio entry point (bin: lfx-changelog-mcp)
│   ├── api-client.ts          # HTTP client for the LFX Changelog public API
│   ├── tools/
│   │   ├── product.tools.ts   # list-products tool
│   │   └── changelog.tools.ts # list-changelogs, get-changelog tools
│   └── resources/
│       └── public.resources.ts # lfx://products, lfx://changelogs resources
└── dist/                      # Compiled output (after yarn build)

apps/lfx-changelog/src/server/routes/
└── mcp.route.ts               # Express route mounting StreamableHTTPServerTransport at POST /mcp
```

The `createMcpServer()` factory builds an `McpServer` instance with all tools
and resources registered. The transport layer is chosen by the consumer:

- **HTTP** — `mcp.route.ts` connects via `StreamableHTTPServerTransport` for
  remote access through the Express server (this is how `changelog.lfx.dev/mcp` works)
- **stdio** — `src/index.ts` connects via `StdioServerTransport` for local CLI usage

### Schema reuse

Tool output schemas are derived from the Zod schemas in `@lfx-changelog/shared`
— the same schemas used for REST API validation and OpenAPI spec generation.
This keeps type definitions in a single source of truth across the REST API,
OpenAPI docs, and MCP server.
