import {
  AI_CHANGELOG_CONFIG,
  AI_CHANGELOG_DESCRIPTION_SYSTEM_PROMPT,
  AI_CHANGELOG_METADATA_SCHEMA,
  AI_CHANGELOG_METADATA_SYSTEM_PROMPT,
  AI_ENDPOINTS,
  AI_MODEL,
  AI_REQUEST_CONFIG,
  AI_SUMMARY_RESPONSE_SCHEMA,
  AI_SUMMARY_SYSTEM_PROMPT,
} from '../constants/ai.constants';
import { AiServiceError } from '../errors';
import { serverLogger } from '../server-logger';

import type {
  AiChangelogMetadata,
  AiSummaryResponse,
  OpenAIChatMessage,
  OpenAIChatRequest,
  OpenAIChatResponse,
  OpenAIStreamChunk,
  PublicChangelogEntry,
} from '@lfx-changelog/shared';

export class AiService {
  private get apiUrl(): string {
    return process.env['AI_API_URL'] || AI_ENDPOINTS.LITE_LLM_CHAT;
  }

  private get apiKey(): string {
    return process.env['LITELLM_API_KEY'] || '';
  }

  public async generateSummary(entries: PublicChangelogEntry[]): Promise<AiSummaryResponse> {
    if (entries.length === 0) {
      throw new AiServiceError('No changelog entries to summarize', { operation: 'generateSummary' });
    }

    if (!this.apiKey) {
      throw new AiServiceError('LITELLM_API_KEY is not configured', { operation: 'generateSummary' });
    }

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const entrySummaries = entries.map((e) => `- [${e.product?.name || 'Unknown'}] ${e.title}: ${e.description?.slice(0, 200)}`).join('\n');

    const userPrompt = `Summarize the following ${entries.length} changelog entries for ${month}:\n\n${entrySummaries}`;

    const messages: OpenAIChatMessage[] = [
      { role: 'system', content: AI_SUMMARY_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const request: OpenAIChatRequest = {
      model: AI_MODEL,
      messages,
      max_tokens: AI_REQUEST_CONFIG.MAX_TOKENS,
      temperature: AI_REQUEST_CONFIG.TEMPERATURE,
      response_format: AI_SUMMARY_RESPONSE_SCHEMA,
    };

    const response = await this.makeAiRequest(request);
    return this.extractSummaryResult(response, entries.length, month);
  }

  public async generateChangelogMetadata(releaseContext: string, additionalContext?: string, abortSignal?: AbortSignal): Promise<AiChangelogMetadata> {
    if (!this.apiKey) {
      throw new AiServiceError('LITELLM_API_KEY is not configured', { operation: 'generateChangelogMetadata' });
    }

    const userPrompt = additionalContext ? `${releaseContext}\n\nAdditional context from the author:\n${additionalContext}` : releaseContext;

    const messages: OpenAIChatMessage[] = [
      { role: 'system', content: AI_CHANGELOG_METADATA_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const request: OpenAIChatRequest = {
      model: AI_MODEL,
      messages,
      max_tokens: AI_CHANGELOG_CONFIG.METADATA_MAX_TOKENS,
      temperature: AI_CHANGELOG_CONFIG.TEMPERATURE,
      response_format: AI_CHANGELOG_METADATA_SCHEMA,
    };

    const response = await this.makeAiRequest(request, abortSignal);
    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new AiServiceError('LiteLLM returned an empty metadata response', { operation: 'generateChangelogMetadata' });
    }

    try {
      return JSON.parse(content) as AiChangelogMetadata;
    } catch {
      throw new AiServiceError('LiteLLM returned invalid JSON for metadata', {
        operation: 'generateChangelogMetadata',
        metadata: { content: content.slice(0, 200) },
      });
    }
  }

  public async *streamChangelogDescription(releaseContext: string, additionalContext?: string, abortSignal?: AbortSignal): AsyncGenerator<string> {
    if (!this.apiKey) {
      throw new AiServiceError('LITELLM_API_KEY is not configured', { operation: 'streamChangelogDescription' });
    }

    const userPrompt = additionalContext ? `${releaseContext}\n\nAdditional context from the author:\n${additionalContext}` : releaseContext;

    const messages: OpenAIChatMessage[] = [
      { role: 'system', content: AI_CHANGELOG_DESCRIPTION_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const request: OpenAIChatRequest = {
      model: AI_MODEL,
      messages,
      max_tokens: AI_CHANGELOG_CONFIG.DESCRIPTION_MAX_TOKENS,
      temperature: AI_CHANGELOG_CONFIG.TEMPERATURE,
      stream: true,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_CHANGELOG_CONFIG.STREAM_TIMEOUT_MS);

    // Cascade external abort signal to our controller
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      serverLogger.info({ model: request.model }, 'Starting streaming AI changelog description request');

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unable to read error body');
        throw new AiServiceError(`LiteLLM returned ${response.status}: ${errorBody}`, {
          operation: 'streamChangelogDescription',
          metadata: { status: response.status },
        });
      }

      if (!response.body) {
        throw new AiServiceError('LiteLLM returned no response body for stream', { operation: 'streamChangelogDescription' });
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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
          if (data === '[DONE]') return;

          try {
            const chunk = JSON.parse(data) as OpenAIStreamChunk;
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }
    } catch (error) {
      if (error instanceof AiServiceError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        serverLogger.info('Streaming AI request was aborted');
        return;
      }
      throw new AiServiceError(`Streaming LiteLLM request failed: ${(error as Error).message}`, {
        operation: 'streamChangelogDescription',
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async makeAiRequest(request: OpenAIChatRequest, externalSignal?: AbortSignal): Promise<OpenAIChatResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_REQUEST_CONFIG.TIMEOUT_MS);

    // Cascade external abort signal (e.g., client disconnect) to our controller
    if (externalSignal) {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      serverLogger.info({ model: request.model, messageCount: request.messages.length }, 'Sending AI request to LiteLLM');

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unable to read error body');
        serverLogger.error({ status: response.status, body: errorBody }, 'LiteLLM API returned an error');
        throw new AiServiceError(`LiteLLM returned ${response.status}: ${errorBody}`, {
          operation: 'makeAiRequest',
          metadata: { status: response.status },
        });
      }

      return (await response.json()) as OpenAIChatResponse;
    } catch (error) {
      if (error instanceof AiServiceError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        // Distinguish between timeout and external cancellation
        const reason = externalSignal?.aborted ? 'Request was cancelled' : `LiteLLM request timed out after ${AI_REQUEST_CONFIG.TIMEOUT_MS}ms`;
        throw new AiServiceError(reason, {
          operation: 'makeAiRequest',
        });
      }
      throw new AiServiceError(`LiteLLM request failed: ${(error as Error).message}`, {
        operation: 'makeAiRequest',
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private extractSummaryResult(response: OpenAIChatResponse, entryCount: number, month: string): AiSummaryResponse {
    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new AiServiceError('LiteLLM returned an empty response', { operation: 'extractSummaryResult' });
    }

    try {
      const parsed = JSON.parse(content) as AiSummaryResponse;
      return {
        summary: parsed.summary,
        entryCount: parsed.entryCount ?? entryCount,
        month: parsed.month ?? month,
        timestamp: new Date().toISOString(),
        products: parsed.products ?? [],
      };
    } catch {
      serverLogger.warn({ content: content.slice(0, 200) }, 'Failed to parse AI JSON response, using raw text');
      return {
        summary: content,
        entryCount,
        month,
        timestamp: new Date().toISOString(),
        products: [],
      };
    }
  }
}
