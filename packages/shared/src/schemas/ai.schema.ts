// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { z } from 'zod';

export type OpenAIChatRole = 'system' | 'user' | 'assistant' | 'tool';

export const OpenAIChatMessageSchema = z
  .object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })
  .openapi('OpenAIChatMessage');

export type OpenAIChatMessage = z.infer<typeof OpenAIChatMessageSchema>;

export const OpenAIJsonSchemaFormatSchema = z
  .object({
    type: z.literal('json_schema'),
    json_schema: z.object({
      name: z.string(),
      strict: z.boolean(),
      schema: z.record(z.string(), z.json()),
    }),
  })
  .openapi('OpenAIJsonSchemaFormat');

export type OpenAIJsonSchemaFormat = z.infer<typeof OpenAIJsonSchemaFormatSchema>;

export const OpenAIChatRequestSchema = z
  .object({
    model: z.string(),
    messages: z.array(OpenAIChatMessageSchema),
    max_tokens: z.number(),
    temperature: z.number(),
    response_format: OpenAIJsonSchemaFormatSchema.optional(),
    stream: z.boolean().optional(),
  })
  .openapi('OpenAIChatRequest');

export type OpenAIChatRequest = z.infer<typeof OpenAIChatRequestSchema>;

export const OpenAIChatChoiceSchema = z
  .object({
    index: z.number(),
    message: z.object({
      role: z.literal('assistant'),
      content: z.string(),
    }),
    finish_reason: z.string(),
  })
  .openapi('OpenAIChatChoice');

export type OpenAIChatChoice = z.infer<typeof OpenAIChatChoiceSchema>;

export const OpenAIChatResponseSchema = z
  .object({
    id: z.string(),
    object: z.string(),
    created: z.number(),
    model: z.string(),
    choices: z.array(OpenAIChatChoiceSchema),
    usage: z
      .object({
        prompt_tokens: z.number(),
        completion_tokens: z.number(),
        total_tokens: z.number(),
      })
      .optional(),
  })
  .openapi('OpenAIChatResponse');

export type OpenAIChatResponse = z.infer<typeof OpenAIChatResponseSchema>;

export const AiProductSummarySchema = z
  .object({
    productName: z.string(),
    highlights: z.array(z.string()),
  })
  .openapi('AiProductSummary');

export type AiProductSummary = z.infer<typeof AiProductSummarySchema>;

export const AiSummaryResponseSchema = z
  .object({
    summary: z.string(),
    entryCount: z.number(),
    month: z.string(),
    timestamp: z.string(),
    products: z.array(AiProductSummarySchema),
  })
  .openapi('AiSummaryResponse');

export type AiSummaryResponse = z.infer<typeof AiSummaryResponseSchema>;

export const GenerateChangelogRequestSchema = z
  .object({
    productId: z.string(),
    releaseCount: z.number(),
    additionalContext: z.string().optional(),
  })
  .openapi('GenerateChangelogRequest');

export type GenerateChangelogRequest = z.infer<typeof GenerateChangelogRequestSchema>;

export const AiChangelogMetadataSchema = z
  .object({
    title: z.string(),
    version: z.string(),
  })
  .openapi('AiChangelogMetadata');

export type AiChangelogMetadata = z.infer<typeof AiChangelogMetadataSchema>;

export const ChangelogGenerationStateSchema = z
  .object({
    generating: z.boolean(),
    status: z.string(),
    title: z.string(),
    version: z.string(),
    description: z.string(),
    error: z.string(),
    done: z.boolean(),
  })
  .openapi('ChangelogGenerationState');

export type ChangelogGenerationState = z.infer<typeof ChangelogGenerationStateSchema>;

export type ChangelogSSEEventType = 'status' | 'title' | 'version' | 'content' | 'done' | 'error';

export const ChangelogSSEEventSchema = z
  .object({
    type: z.enum(['status', 'title', 'version', 'content', 'done', 'error']),
    data: z.string(),
  })
  .openapi('ChangelogSSEEvent');

export type ChangelogSSEEvent = z.infer<typeof ChangelogSSEEventSchema>;

export const OpenAIStreamDeltaChoiceSchema = z
  .object({
    index: z.number(),
    delta: z.object({ content: z.string().optional() }),
    finish_reason: z.string().nullable(),
  })
  .openapi('OpenAIStreamDeltaChoice');

export type OpenAIStreamDeltaChoice = z.infer<typeof OpenAIStreamDeltaChoiceSchema>;

export const OpenAIStreamChunkSchema = z
  .object({
    id: z.string(),
    object: z.string(),
    created: z.number(),
    model: z.string(),
    choices: z.array(OpenAIStreamDeltaChoiceSchema),
  })
  .openapi('OpenAIStreamChunk');

export type OpenAIStreamChunk = z.infer<typeof OpenAIStreamChunkSchema>;

// --- Tool-calling extensions ---

export const OpenAIToolCallFunctionSchema = z.object({
  name: z.string(),
  arguments: z.string(),
});

export type OpenAIToolCallFunction = z.infer<typeof OpenAIToolCallFunctionSchema>;

export const OpenAIToolCallSchema = z
  .object({
    id: z.string(),
    type: z.literal('function'),
    function: OpenAIToolCallFunctionSchema,
  })
  .openapi('OpenAIToolCall');

export type OpenAIToolCall = z.infer<typeof OpenAIToolCallSchema>;

export const OpenAIToolChatMessageSchema = z
  .object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.string().nullable().optional(),
    tool_calls: z.array(OpenAIToolCallSchema).optional(),
    tool_call_id: z.string().optional(),
    name: z.string().optional(),
  })
  .openapi('OpenAIToolChatMessage');

export type OpenAIToolChatMessage = z.infer<typeof OpenAIToolChatMessageSchema>;

export const OpenAIFunctionToolSchema = z.object({
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    description: z.string(),
    parameters: z.record(z.string(), z.json()),
  }),
});

export type OpenAIFunctionTool = z.infer<typeof OpenAIFunctionToolSchema>;

export const OpenAIToolChatRequestSchema = z
  .object({
    model: z.string(),
    messages: z.array(OpenAIToolChatMessageSchema),
    max_tokens: z.number(),
    temperature: z.number(),
    tools: z.array(OpenAIFunctionToolSchema).optional(),
    stream: z.boolean().optional(),
  })
  .openapi('OpenAIToolChatRequest');

export type OpenAIToolChatRequest = z.infer<typeof OpenAIToolChatRequestSchema>;

export const OpenAIToolChatChoiceSchema = z
  .object({
    index: z.number(),
    message: z.object({
      role: z.literal('assistant'),
      content: z.string().nullable().optional(),
      tool_calls: z.array(OpenAIToolCallSchema).optional(),
    }),
    finish_reason: z.string(),
  })
  .openapi('OpenAIToolChatChoice');

export type OpenAIToolChatChoice = z.infer<typeof OpenAIToolChatChoiceSchema>;

export const OpenAIToolChatResponseSchema = z
  .object({
    id: z.string(),
    object: z.string(),
    created: z.number(),
    model: z.string(),
    choices: z.array(OpenAIToolChatChoiceSchema),
    usage: z
      .object({
        prompt_tokens: z.number(),
        completion_tokens: z.number(),
        total_tokens: z.number(),
      })
      .optional(),
  })
  .openapi('OpenAIToolChatResponse');

export type OpenAIToolChatResponse = z.infer<typeof OpenAIToolChatResponseSchema>;
