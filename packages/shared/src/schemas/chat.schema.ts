// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { z } from 'zod';

import { OpenAIToolCallSchema } from './ai.schema.js';

// --- Enums ---

export const ChatAccessLevelSchema = z.enum(['public', 'admin']);
export type ChatAccessLevel = z.infer<typeof ChatAccessLevelSchema>;

export const ChatMessageRoleSchema = z.enum(['user', 'assistant', 'system', 'tool']);
export type ChatMessageRole = z.infer<typeof ChatMessageRoleSchema>;

// --- Persisted models ---

export const ChatMessageSchema = z
  .object({
    id: z.string().uuid(),
    conversationId: z.string().uuid(),
    role: ChatMessageRoleSchema,
    content: z.string().nullable().optional(),
    toolCalls: z.array(OpenAIToolCallSchema).nullable().optional(),
    toolCallId: z.string().nullable().optional(),
    toolName: z.string().nullable().optional(),
    createdAt: z.string().datetime(),
  })
  .openapi('ChatMessage');

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatConversationSchema = z
  .object({
    id: z.string().uuid(),
    userId: z.string().uuid().nullable().optional(),
    title: z.string(),
    accessLevel: ChatAccessLevelSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('ChatConversation');

export type ChatConversation = z.infer<typeof ChatConversationSchema>;

export const ChatConversationWithMessagesSchema = ChatConversationSchema.extend({
  messages: z.array(ChatMessageSchema),
}).openapi('ChatConversationWithMessages');

export type ChatConversationWithMessages = z.infer<typeof ChatConversationWithMessagesSchema>;

// --- Request DTOs ---

export const SendChatMessageRequestSchema = z
  .object({
    conversationId: z.string().uuid().optional(),
    message: z.string().min(1).max(4000),
  })
  .openapi('SendChatMessageRequest');

export type SendChatMessageRequest = z.infer<typeof SendChatMessageRequestSchema>;

/** Parameters for persisting a chat message to the database. */
export const AddChatMessageParamsSchema = z.object({
  role: ChatMessageRoleSchema,
  content: z.string().nullable().optional(),
  toolCalls: z.array(OpenAIToolCallSchema).nullable().optional(),
  toolCallId: z.string().nullable().optional(),
  toolName: z.string().nullable().optional(),
});

export type AddChatMessageParams = z.infer<typeof AddChatMessageParamsSchema>;

/** Minimal message shape for UI display (user + assistant only). */
export const ChatMessageUISchema = z.object({
  id: z.string().optional(),
  role: ChatMessageRoleSchema,
  content: z.string(),
});

export type ChatMessageUI = z.infer<typeof ChatMessageUISchema>;

// --- Tool argument schemas ---

export const SearchChangelogsToolArgsSchema = z.object({
  productId: z.string().optional(),
  status: z.string().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
});

export type SearchChangelogsToolArgs = z.infer<typeof SearchChangelogsToolArgsSchema>;

export const GetChangelogDetailToolArgsSchema = z.object({
  id: z.string(),
});

export type GetChangelogDetailToolArgs = z.infer<typeof GetChangelogDetailToolArgsSchema>;

// --- Streaming types ---

/** Shape of a streaming delta tool_call chunk from the OpenAI API. */
export const StreamDeltaToolCallSchema = z.object({
  index: z.number(),
  id: z.string().optional(),
  type: z.string().optional(),
  function: z
    .object({
      name: z.string().optional(),
      arguments: z.string().optional(),
    })
    .optional(),
});

export type StreamDeltaToolCall = z.infer<typeof StreamDeltaToolCallSchema>;

/** Shape of a streaming SSE chunk from the OpenAI API. */
export const StreamDeltaChunkSchema = z.object({
  choices: z
    .array(
      z.object({
        delta: z
          .object({
            content: z.string().nullable().optional(),
            tool_calls: z.array(StreamDeltaToolCallSchema).optional(),
          })
          .optional(),
        finish_reason: z.string().nullable().optional(),
      })
    )
    .optional(),
});

export type StreamDeltaChunk = z.infer<typeof StreamDeltaChunkSchema>;

// --- SSE events ---

export type ChatSSEEventType = 'status' | 'content' | 'tool_call' | 'conversation_id' | 'title' | 'done' | 'error';

export const ChatSSEEventSchema = z
  .object({
    type: z.enum(['status', 'content', 'tool_call', 'conversation_id', 'title', 'done', 'error']),
    data: z.string(),
  })
  .openapi('ChatSSEEvent');

export type ChatSSEEvent = z.infer<typeof ChatSSEEventSchema>;
