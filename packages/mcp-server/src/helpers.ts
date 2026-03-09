// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Creates a successful tool result with both text content (for display) and
 * structured content (for programmatic consumption when outputSchema is set).
 */
export function jsonResult(data: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    structuredContent: data as Record<string, unknown>,
  };
}

/**
 * Creates an error tool result from a caught exception.
 */
export function errorResult(label: string, error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text', text: `${label}: ${message}` }],
    isError: true,
  };
}
