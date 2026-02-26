// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

/** Role in an OpenAI-compatible chat message. */
export type OpenAIChatRole = 'system' | 'user' | 'assistant';

/** Single message in an OpenAI-compatible chat conversation. */
export interface OpenAIChatMessage {
  role: OpenAIChatRole;
  content: string;
}

/** JSON Schema response format for structured AI output. */
export interface OpenAIJsonSchemaFormat {
  type: 'json_schema';
  json_schema: {
    name: string;
    strict: boolean;
    schema: Record<string, unknown>;
  };
}

/** Request body for the OpenAI-compatible /chat/completions endpoint. */
export interface OpenAIChatRequest {
  model: string;
  messages: OpenAIChatMessage[];
  max_tokens: number;
  temperature: number;
  response_format?: OpenAIJsonSchemaFormat;
  stream?: boolean;
}

/** Single choice in an OpenAI-compatible chat completion response. */
export interface OpenAIChatChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string;
  };
  finish_reason: string;
}

/** Response body from the OpenAI-compatible /chat/completions endpoint. */
export interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIChatChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** Product summary within an AI-generated changelog summary. */
export interface AiProductSummary {
  productName: string;
  highlights: string[];
}

/** Structured response from the AI changelog summary endpoint. */
export interface AiSummaryResponse {
  summary: string;
  entryCount: number;
  month: string;
  timestamp: string;
  products: AiProductSummary[];
}

/** Request to generate a changelog from GitHub releases via AI. */
export interface GenerateChangelogRequest {
  productId: string;
  releaseCount: number;
  additionalContext?: string;
}

/** Title + version metadata returned by the non-streaming AI call. */
export interface AiChangelogMetadata {
  title: string;
  version: string;
}

/** Full lifecycle state for changelog generation (used as Angular signal value). */
export interface ChangelogGenerationState {
  generating: boolean;
  status: string;
  title: string;
  version: string;
  description: string;
  error: string;
  done: boolean;
}

/** SSE event types emitted during changelog generation. */
export type ChangelogSSEEventType = 'status' | 'title' | 'version' | 'content' | 'done' | 'error';

/** A single SSE event from the changelog generation stream. */
export interface ChangelogSSEEvent {
  type: ChangelogSSEEventType;
  data: string;
}

/** Single choice delta in a streaming OpenAI-compatible response. */
export interface OpenAIStreamDeltaChoice {
  index: number;
  delta: { content?: string };
  finish_reason: string | null;
}

/** A single chunk from a streaming OpenAI-compatible /chat/completions response. */
export interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIStreamDeltaChoice[];
}
