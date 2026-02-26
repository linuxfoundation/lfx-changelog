// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { AiChangelogMetadata, OpenAIJsonSchemaFormat } from '@lfx-changelog/shared';

/** LiteLLM proxy endpoint. Override via AI_API_URL env var. */
export const AI_ENDPOINTS = {
  LITE_LLM_CHAT: 'https://litellm.dev.v2.cluster.linuxfound.info/chat/completions',
} as const;

/** Default model routed through LiteLLM. */
export const AI_MODEL = 'claude-sonnet-4-6';

/** Request-level defaults. */
export const AI_REQUEST_CONFIG = {
  MAX_TOKENS: 2048,
  TEMPERATURE: 0.3,
  TIMEOUT_MS: 25_000,
} as const;

/** System prompt instructing the LLM to summarize changelog entries. */
export const AI_SUMMARY_SYSTEM_PROMPT = `You are a technical writer summarizing changelog entries for the Linux Foundation's LFX platform.
Given a list of published changelog entries, produce a concise executive summary covering the most important changes across all products.
Group highlights by product. Use clear, professional language suitable for a technical audience.
Keep the overall summary to 2-3 sentences. Each product should have 1-3 bullet-point highlights.`;

/** Configuration for AI changelog generation. */
export const AI_CHANGELOG_CONFIG = {
  METADATA_MAX_TOKENS: 256,
  DESCRIPTION_MAX_TOKENS: 4096,
  TEMPERATURE: 0.4,
  STREAM_TIMEOUT_MS: 120_000,
} as const;

/** System prompt for generating changelog title + version (non-streaming, JSON output). */
export const AI_CHANGELOG_METADATA_SYSTEM_PROMPT = `You are a technical writer for the Linux Foundation's LFX platform.
Given GitHub release data (release notes, tags, and commit summaries), generate a user-friendly changelog title and a clean version string.

Title rules:
- Write a short, human-readable headline (max 60 chars) that captures the theme of the changes.
- Focus on WHAT improved for users, not technical details. Example: "Faster Builds and Improved Dashboard" not "Update webpack config and fix CSS grid layout".
- Do not mention repo names, tag names, or PR numbers.
- Use title case.

Version rules:
- Extract a clean semantic version (e.g., "2.5.0") from the release tags.
- Strip any prefixes like "v", "release-", "@scope/pkg@", or similar.
- If the tag is not semver (e.g., "2024-01-15"), simplify it to just the version-like portion.
- If multiple repos have different versions, use the highest one.
- Do NOT include "v" prefix in the version field.`;

/** JSON schema for changelog metadata (title + version). */
export const AI_CHANGELOG_METADATA_SCHEMA: OpenAIJsonSchemaFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'changelog_metadata',
    strict: true,
    schema: {
      type: 'object',
      required: ['title', 'version'] satisfies (keyof AiChangelogMetadata)[],
      additionalProperties: false,
      properties: {
        title: {
          type: 'string',
          description: 'A short, user-friendly headline in title case (max 60 chars).',
        },
        version: {
          type: 'string',
          description: 'Clean semantic version (e.g., "2.5.0") without prefixes like "v" or "release-".',
        },
      },
    },
  },
};

/** System prompt for generating changelog description (streaming, markdown output). */
export const AI_CHANGELOG_DESCRIPTION_SYSTEM_PROMPT = `You are a technical writer for the Linux Foundation's LFX platform.
Given GitHub release data (release notes, tags, and commit summaries), write a user-friendly changelog description in markdown.

Rules:
- Use ## headings for major sections (e.g., "## New Features", "## Bug Fixes", "## Improvements").
- Use bullet points under each heading.
- Write for end users — avoid internal jargon, PR numbers, and commit SHAs.
- Focus on what changed and why it matters to users.
- Do NOT include a title or version at the top — those are generated separately.
- Keep it concise but informative. Aim for 200-500 words.
- If additional context is provided, use it to guide emphasis and filtering.`;

/** JSON schema for structured summary output. */
export const AI_SUMMARY_RESPONSE_SCHEMA: OpenAIJsonSchemaFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'changelog_summary',
    strict: true,
    schema: {
      type: 'object',
      required: ['summary', 'entryCount', 'month', 'products'],
      additionalProperties: false,
      properties: {
        summary: {
          type: 'string',
          description: 'A 2-3 sentence executive summary of all changes.',
        },
        entryCount: {
          type: 'integer',
          description: 'Total number of changelog entries summarized.',
        },
        month: {
          type: 'string',
          description: 'The month covered, in YYYY-MM format.',
        },
        products: {
          type: 'array',
          description: 'Per-product highlight groups.',
          items: {
            type: 'object',
            required: ['productName', 'highlights'],
            additionalProperties: false,
            properties: {
              productName: { type: 'string' },
              highlights: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
};
