// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { AI_ENDPOINTS, AI_MODEL } from '../constants/ai.constants';
import { CHAT_TOOLS_ADMIN, CHAT_TOOLS_PUBLIC } from '../constants/chat-tools.constants';
import { CHAT_CONFIG, CHAT_SYSTEM_PROMPT_ADMIN, CHAT_SYSTEM_PROMPT_PUBLIC } from '../constants/chat.constants';
import { AiServiceError } from '../errors';
import { serverLogger } from '../server-logger';

import { ChatToolExecutorService } from './chat-tool-executor.service';

import type { ChatAccessLevel, ChatSSEEvent, OpenAIFunctionTool, OpenAIToolCall, OpenAIToolChatMessage, StreamDeltaChunk } from '@lfx-changelog/shared';
import type { StreamResult } from '../interfaces/chat.interface';

export class ChatAiService {
  private readonly toolExecutor = new ChatToolExecutorService();

  private get apiUrl(): string {
    return process.env['AI_API_URL'] || AI_ENDPOINTS.LITE_LLM_CHAT;
  }

  private get apiKey(): string {
    return process.env['LITELLM_API_KEY'] || '';
  }

  /**
   * Streams chat with persistence support.
   * Every LLM request is streaming — tool_calls are accumulated from deltas,
   * text content is yielded immediately for real-time UI updates.
   * The final 'done' event carries _newMessages for the controller to persist.
   */
  public async *streamChatWithPersistence(
    conversationMessages: OpenAIToolChatMessage[],
    accessLevel: ChatAccessLevel,
    abortSignal?: AbortSignal
  ): AsyncGenerator<ChatSSEEvent & { _newMessages?: OpenAIToolChatMessage[] }> {
    if (!this.apiKey) {
      throw new AiServiceError('LITELLM_API_KEY is not configured', { operation: 'streamChatWithPersistence' });
    }

    const systemPrompt = accessLevel === 'admin' ? CHAT_SYSTEM_PROMPT_ADMIN : CHAT_SYSTEM_PROMPT_PUBLIC;
    const tools = accessLevel === 'admin' ? CHAT_TOOLS_ADMIN : CHAT_TOOLS_PUBLIC;

    const messages: OpenAIToolChatMessage[] = [{ role: 'system', content: systemPrompt }, ...conversationMessages];
    const newMessages: OpenAIToolChatMessage[] = [];

    // Agentic loop — every round is streaming
    for (let iteration = 0; iteration < CHAT_CONFIG.MAX_TOOL_ITERATIONS; iteration++) {
      const result: StreamResult = { content: '', toolCalls: [], finishReason: null };

      // Stream the request and yield content chunks in real time
      for await (const event of this.streamRequest(messages, tools, result, abortSignal)) {
        yield event;
      }

      // Did the model call tools?
      if (result.toolCalls.length > 0) {
        // Persist the assistant's tool_calls message
        const assistantMsg: OpenAIToolChatMessage = {
          role: 'assistant',
          content: result.content || null,
          tool_calls: result.toolCalls,
        };
        messages.push(assistantMsg);
        newMessages.push(assistantMsg);

        // Execute each tool call
        for (const toolCall of result.toolCalls) {
          yield { type: 'tool_call', data: toolCall.function.name };

          const toolResult = await this.toolExecutor.execute(toolCall, accessLevel);

          const toolMsg: OpenAIToolChatMessage = {
            role: 'tool',
            content: toolResult,
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
          };
          messages.push(toolMsg);
          newMessages.push(toolMsg);
        }

        continue;
      }

      // No tool calls — text response is complete
      newMessages.push({ role: 'assistant', content: result.content });
      yield { type: 'done', data: '', _newMessages: newMessages };
      return;
    }

    // Exhausted tool iterations — yield whatever content we have
    serverLogger.warn({ iterations: CHAT_CONFIG.MAX_TOOL_ITERATIONS }, 'Chat exceeded max tool iterations');
    yield { type: 'done', data: '', _newMessages: newMessages };
  }

  /**
   * Makes a single streaming request to LiteLLM.
   * - Yields { type: 'content', data } for each text token (real-time streaming)
   * - Accumulates tool_calls in the result object (not yielded as content)
   * - Populates result.content and result.finishReason when done
   */
  private async *streamRequest(
    messages: OpenAIToolChatMessage[],
    tools: OpenAIFunctionTool[],
    result: StreamResult,
    abortSignal?: AbortSignal
  ): AsyncGenerator<ChatSSEEvent> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CHAT_CONFIG.STREAM_TIMEOUT_MS);

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      serverLogger.info({ model: AI_MODEL, messageCount: messages.length }, 'Chat: sending streaming request to LiteLLM');

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages,
          max_tokens: CHAT_CONFIG.MAX_TOKENS,
          temperature: CHAT_CONFIG.TEMPERATURE,
          tools,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unable to read error body');
        throw new AiServiceError(`LiteLLM returned ${response.status}: ${errorBody}`, {
          operation: 'streamRequest',
          metadata: { status: response.status },
        });
      }

      if (!response.body) {
        throw new AiServiceError('LiteLLM returned no response body for stream', { operation: 'streamRequest' });
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Map of tool call index → accumulated tool call data
      const toolCallMap = new Map<number, OpenAIToolCall>();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            // Finalize accumulated tool calls
            result.toolCalls = [...toolCallMap.values()];
            return;
          }

          try {
            const chunk = JSON.parse(data) as StreamDeltaChunk;

            const choice = chunk.choices?.[0];
            if (!choice) continue;

            const delta = choice.delta;

            // Track finish reason
            if (choice.finish_reason) {
              result.finishReason = choice.finish_reason;
            }

            if (!delta) continue;

            // Accumulate text content — yield immediately for streaming UI
            if (delta.content) {
              result.content += delta.content;
              yield { type: 'content', data: delta.content };
            }

            // Accumulate tool calls from deltas
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const existing = toolCallMap.get(tc.index);
                if (existing) {
                  // Append to existing tool call's arguments
                  if (tc.function?.arguments) {
                    existing.function.arguments += tc.function.arguments;
                  }
                  if (tc.function?.name) {
                    existing.function.name = tc.function.name;
                  }
                } else {
                  // New tool call
                  toolCallMap.set(tc.index, {
                    id: tc.id || '',
                    type: 'function',
                    function: {
                      name: tc.function?.name || '',
                      arguments: tc.function?.arguments || '',
                    },
                  });
                }
              }
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }

      // Stream ended without [DONE] — finalize
      result.toolCalls = [...toolCallMap.values()];
    } catch (error) {
      if (error instanceof AiServiceError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        serverLogger.info('Chat streaming request was aborted');
        return;
      }
      throw new AiServiceError(`Streaming LiteLLM request failed: ${(error as Error).message}`, {
        operation: 'streamRequest',
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
