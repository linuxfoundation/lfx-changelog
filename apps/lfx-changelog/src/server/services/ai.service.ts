// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import {
  AI_CHANGELOG_CONFIG,
  AI_CHANGELOG_DESCRIPTION_SYSTEM_PROMPT,
  AI_CHANGELOG_METADATA_SCHEMA,
  AI_CHANGELOG_METADATA_SYSTEM_PROMPT,
  AI_MODEL,
  AI_REQUEST_CONFIG,
  AI_SUMMARY_RESPONSE_SCHEMA,
  AI_SUMMARY_SYSTEM_PROMPT,
} from '../constants/ai.constants';
import { CHAT_TOOLS_ADMIN, CHAT_TOOLS_PUBLIC } from '../constants/chat-tools.constants';
import { CHAT_CONFIG, CHAT_SYSTEM_PROMPT_ADMIN, CHAT_SYSTEM_PROMPT_PUBLIC } from '../constants/chat.constants';
import { AiServiceError } from '../errors';
import { serverLogger } from '../server-logger';
import { ChangelogService } from './changelog.service';
import { ProductService } from './product.service';
import { SearchService } from './search.service';

import type {
  AiChangelogMetadata,
  AiSummaryResponse,
  BlogSearchHit,
  ChangelogSearchHit,
  ChatSSEEvent,
  GetChangelogDetailToolArgs,
  OpenAIChatMessage,
  OpenAIChatRequest,
  OpenAIChatResponse,
  OpenAIFunctionTool,
  OpenAIStreamChunk,
  OpenAIToolCall,
  OpenAIToolChatMessage,
  PublicChangelogEntry,
  SearchToolArgs,
  StreamDeltaChunk,
} from '@lfx-changelog/shared';
import type { ChatCallerContext, StreamResult } from '../interfaces/chat.interface';

export class AiService {
  private readonly productService = new ProductService();
  private readonly changelogService = new ChangelogService();
  private readonly searchService = new SearchService();

  private get apiUrl(): string {
    return process.env['AI_API_URL'] as string;
  }

  private get apiKey(): string {
    return process.env['LITELLM_API_KEY'] as string;
  }

  // ── Summary & changelog generation ───────────────────────────

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

  // ── Chat (agentic tool-calling loop) ───────────────────────────

  public async *streamChatWithPersistence(
    conversationMessages: OpenAIToolChatMessage[],
    callerContext: ChatCallerContext,
    abortSignal?: AbortSignal
  ): AsyncGenerator<ChatSSEEvent & { _newMessages?: OpenAIToolChatMessage[] }> {
    if (!this.apiKey) {
      throw new AiServiceError('LITELLM_API_KEY is not configured', { operation: 'streamChatWithPersistence' });
    }

    const { accessLevel } = callerContext;
    const systemPrompt = accessLevel === 'admin' ? CHAT_SYSTEM_PROMPT_ADMIN : CHAT_SYSTEM_PROMPT_PUBLIC;
    const tools = accessLevel === 'admin' ? CHAT_TOOLS_ADMIN : CHAT_TOOLS_PUBLIC;

    const messages: OpenAIToolChatMessage[] = [{ role: 'system', content: systemPrompt }, ...conversationMessages];
    const newMessages: OpenAIToolChatMessage[] = [];

    for (let iteration = 0; iteration < CHAT_CONFIG.MAX_TOOL_ITERATIONS; iteration++) {
      const result: StreamResult = { content: '', toolCalls: [], finishReason: null };

      for await (const event of this.streamChatRequest(messages, tools, result, abortSignal)) {
        yield event;
      }

      if (result.toolCalls.length > 0) {
        const assistantMsg: OpenAIToolChatMessage = {
          role: 'assistant',
          content: result.content || null,
          tool_calls: result.toolCalls,
        };
        messages.push(assistantMsg);
        newMessages.push(assistantMsg);

        for (const toolCall of result.toolCalls) {
          yield { type: 'tool_call', data: toolCall.function.name };

          const toolResult = await this.executeChatTool(toolCall, callerContext);

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

      newMessages.push({ role: 'assistant', content: result.content });
      yield { type: 'done', data: '', _newMessages: newMessages };
      return;
    }

    serverLogger.warn({ iterations: CHAT_CONFIG.MAX_TOOL_ITERATIONS }, 'Chat exceeded max tool iterations');
    yield { type: 'done', data: '', _newMessages: newMessages };
  }

  // ── Chat tool execution ───────────────────────────

  private async executeChatTool(toolCall: OpenAIToolCall, callerContext: ChatCallerContext): Promise<string> {
    const { name, arguments: argsString } = toolCall.function;
    const { accessLevel } = callerContext;

    let parsedArgs: Record<string, unknown> = {};
    try {
      parsedArgs = JSON.parse(argsString) as Record<string, unknown>;
    } catch {
      return JSON.stringify({ error: `Invalid JSON arguments for tool ${name}` });
    }

    serverLogger.info({ tool: name, args: parsedArgs, accessLevel }, 'Executing chat tool');

    try {
      switch (name) {
        case 'list_products':
          return await this.chatListProducts(accessLevel);
        case 'search': {
          const searchArgs = parsedArgs as SearchToolArgs;
          if (searchArgs.target === 'blogs') {
            return await this.chatSearchBlogs(searchArgs);
          }
          return await this.chatSearchChangelogs(searchArgs, callerContext);
        }
        case 'get_changelog_detail':
          return await this.chatGetChangelogDetail(parsedArgs as GetChangelogDetailToolArgs, callerContext);
        default:
          return JSON.stringify({ error: `Unknown tool: ${name}` });
      }
    } catch (error) {
      serverLogger.error({ err: error, tool: name }, 'Chat tool execution failed');
      return JSON.stringify({ error: `Tool ${name} failed: ${(error as Error).message}` });
    }
  }

  // ── Private helpers ───────────────────────────

  private async makeAiRequest(request: OpenAIChatRequest, externalSignal?: AbortSignal): Promise<OpenAIChatResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_REQUEST_CONFIG.TIMEOUT_MS);

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

  private async *streamChatRequest(
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
          operation: 'streamChatRequest',
          metadata: { status: response.status },
        });
      }

      if (!response.body) {
        throw new AiServiceError('LiteLLM returned no response body for stream', { operation: 'streamChatRequest' });
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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
            result.toolCalls = [...toolCallMap.values()];
            return;
          }

          try {
            const chunk = JSON.parse(data) as StreamDeltaChunk;

            const choice = chunk.choices?.[0];
            if (!choice) continue;

            const delta = choice.delta;

            if (choice.finish_reason) {
              result.finishReason = choice.finish_reason;
            }

            if (!delta) continue;

            if (delta.content) {
              result.content += delta.content;
              yield { type: 'content', data: delta.content };
            }

            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const existing = toolCallMap.get(tc.index);
                if (existing) {
                  if (tc.function?.arguments) {
                    existing.function.arguments += tc.function.arguments;
                  }
                  if (tc.function?.name) {
                    existing.function.name = tc.function.name;
                  }
                } else {
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

      result.toolCalls = [...toolCallMap.values()];
    } catch (error) {
      if (error instanceof AiServiceError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        serverLogger.info('Chat streaming request was aborted');
        return;
      }
      throw new AiServiceError(`Streaming LiteLLM request failed: ${(error as Error).message}`, {
        operation: 'streamChatRequest',
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async chatListProducts(accessLevel: ChatCallerContext['accessLevel']): Promise<string> {
    const products = accessLevel === 'admin' ? await this.productService.findAll() : await this.productService.findAllPublic();

    const summary = products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
    }));

    return JSON.stringify({ products: summary, count: summary.length });
  }

  private async chatSearchChangelogs(args: SearchToolArgs, callerContext: ChatCallerContext): Promise<string> {
    const limit = args.limit || 10;
    const page = args.page || 1;

    if (args.query && callerContext.accessLevel === 'public' && this.searchService.getClient()) {
      return this.chatSearchChangelogsViaOpenSearch(args.query, args.productId, page, limit);
    }

    return this.chatSearchChangelogsViaDB(args, callerContext, page, limit);
  }

  private async chatSearchChangelogsViaOpenSearch(query: string, productId: string | undefined, page: number, limit: number): Promise<string> {
    try {
      const result = await this.searchService.search<ChangelogSearchHit>({ target: 'changelogs', q: query, productId, page, limit });

      const entries = result.hits.map((hit) => ({
        id: hit.id,
        title: this.stripHighlightTags(hit.highlights?.title?.[0]) || hit.title,
        description: hit.description
          ? hit.description.slice(0, CHAT_CONFIG.DESCRIPTION_TRUNCATE_LENGTH) + (hit.description.length > CHAT_CONFIG.DESCRIPTION_TRUNCATE_LENGTH ? '...' : '')
          : null,
        version: hit.version,
        status: hit.status,
        publishedAt: hit.publishedAt,
        productName: hit.productName,
        productSlug: hit.productSlug,
        score: hit.score,
      }));

      return JSON.stringify({
        entries,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
        searchMethod: 'opensearch',
      });
    } catch (error) {
      serverLogger.warn({ err: error }, 'OpenSearch search failed in chat tool, falling back to DB');
      // target is required by SearchToolArgs but ignored by the DB fallback path
      return this.chatSearchChangelogsViaDB({ target: 'changelogs', query, productId, page, limit }, { accessLevel: 'public' }, page, limit);
    }
  }

  private async chatSearchChangelogsViaDB(args: SearchToolArgs, callerContext: ChatCallerContext, page: number, limit: number): Promise<string> {
    const { accessLevel, accessibleProductIds } = callerContext;
    const params = {
      productId: args.productId,
      status: accessLevel === 'admin' ? args.status : undefined,
      query: args.query,
      page,
      limit,
      accessibleProductIds,
    };

    const result = accessLevel === 'admin' ? await this.changelogService.findAll(params) : await this.changelogService.findPublished(params);

    const truncatedData = result.data.map((entry) => ({
      id: entry.id,
      title: entry.title,
      description: entry.description
        ? entry.description.slice(0, CHAT_CONFIG.DESCRIPTION_TRUNCATE_LENGTH) +
          (entry.description.length > CHAT_CONFIG.DESCRIPTION_TRUNCATE_LENGTH ? '...' : '')
        : null,
      version: entry.version,
      status: entry.status,
      publishedAt: entry.publishedAt,
      createdAt: entry.createdAt,
      product: 'product' in entry ? entry.product : undefined,
    }));

    return JSON.stringify({
      entries: truncatedData,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
      searchMethod: 'database',
    });
  }

  private async chatSearchBlogs(args: SearchToolArgs): Promise<string> {
    const limit = args.limit || 10;
    const page = args.page || 1;

    if (!this.searchService.getClient()) {
      return JSON.stringify({ error: 'Blog search requires OpenSearch. No results available — try searching changelogs instead.' });
    }

    if (!args.query) {
      return JSON.stringify({ error: 'A search query is required for blog search' });
    }

    try {
      const result = await this.searchService.search<BlogSearchHit>({ target: 'blogs', q: args.query, type: args.type, page, limit });

      const posts = result.hits.map((hit) => ({
        id: hit.id,
        title: this.stripHighlightTags(hit.highlights?.title?.[0]) || hit.title,
        excerpt: hit.excerpt
          ? hit.excerpt.slice(0, CHAT_CONFIG.DESCRIPTION_TRUNCATE_LENGTH) + (hit.excerpt.length > CHAT_CONFIG.DESCRIPTION_TRUNCATE_LENGTH ? '...' : '')
          : null,
        type: hit.type,
        authorName: hit.authorName,
        publishedAt: hit.publishedAt,
        score: hit.score,
      }));

      return JSON.stringify({
        posts,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      });
    } catch (error) {
      serverLogger.warn({ err: error }, 'Blog search failed in chat tool');
      return JSON.stringify({ error: 'Blog search failed — please try again later' });
    }
  }

  private stripHighlightTags(text: string | undefined): string | undefined {
    return text?.replace(/<\/?mark>/g, '');
  }

  private async chatGetChangelogDetail(args: GetChangelogDetailToolArgs, callerContext: ChatCallerContext): Promise<string> {
    const { accessLevel, accessibleProductIds } = callerContext;

    if (accessLevel === 'admin') {
      const entry = await this.changelogService.findById(args.id);

      // Non-super-admins cannot view drafts for products they don't have access to
      if (entry.status === 'draft' && accessibleProductIds && !accessibleProductIds.includes(entry.productId)) {
        return JSON.stringify({ error: 'You do not have access to this draft' });
      }

      return this.serializeChangelogEntry(entry);
    }

    const entry = await this.changelogService.findPublishedByIdentifier(args.id);
    return this.serializeChangelogEntry(entry);
  }

  private serializeChangelogEntry(entry: {
    id: string;
    title: string;
    description: string;
    version: string | null;
    status: string;
    publishedAt: unknown;
    createdAt: unknown;
    product?: unknown;
  }): string {
    return JSON.stringify({
      id: entry.id,
      title: entry.title,
      description: entry.description,
      version: entry.version,
      status: entry.status,
      publishedAt: entry.publishedAt,
      createdAt: entry.createdAt,
      product: entry.product,
    });
  }
}
