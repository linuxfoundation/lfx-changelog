// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { UserRole } from '@lfx-changelog/shared';

import { CHAT_CONFIG } from '../constants/chat.constants';
import { serverLogger } from '../server-logger';
import { ChatAiService } from '../services/chat-ai.service';
import { ChatConversationService } from '../services/chat-conversation.service';

import type { ChatAccessLevel, ChatSSEEventType, OpenAIToolCall, OpenAIToolChatMessage, SendChatMessageRequest } from '@lfx-changelog/shared';
import type { ChatMessage as PrismaChatMessage, UserRoleAssignment } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import type { FlushableResponse } from '../interfaces/chat.interface';

export class ChatController {
  private readonly chatAiService = new ChatAiService();
  private readonly conversationService = new ChatConversationService();

  public async sendMessage(req: Request, res: Response): Promise<void> {
    const { conversationId, message } = req.body as SendChatMessageRequest;
    const userId = req.dbUser?.id ?? null;
    const accessLevel = this.resolveAccessLevel(req);

    await this.handleChatStream(req, res, { conversationId, message, accessLevel, userId });
  }

  public async sendPublicMessage(req: Request, res: Response): Promise<void> {
    const { conversationId, message } = req.body as SendChatMessageRequest;

    await this.handleChatStream(req, res, { conversationId, message, accessLevel: 'public', userId: null });
  }

  public async listConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.dbUser!.id;
      const limit = Math.min(Number(req.query['limit']) || 20, 50);
      const conversations = await this.conversationService.listConversations(userId, limit);
      res.json({ success: true, data: conversations });
    } catch (error) {
      next(error);
    }
  }

  public async getConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const conversation = await this.conversationService.getConversation(id);

      // Block unauthenticated callers from reading admin conversations
      if (!req.dbUser && conversation.accessLevel === 'admin') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      // Block authenticated users from reading other users' conversations
      if (req.dbUser && conversation.userId && conversation.userId !== req.dbUser.id) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      res.json({ success: true, data: conversation });
    } catch (error) {
      next(error);
    }
  }

  public async deleteConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      await this.conversationService.deleteConversation(id, req.dbUser!.id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  private async handleChatStream(
    req: Request,
    res: Response,
    params: { conversationId?: string; message: string; accessLevel: ChatAccessLevel; userId: string | null }
  ): Promise<void> {
    const { message, accessLevel, userId } = params;
    const flushableRes = res as FlushableResponse;

    // SSE headers — Content-Encoding: identity bypasses compression middleware
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Content-Encoding', 'identity');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Disable Nagle's algorithm — send each SSE event immediately instead of
    // batching small writes into larger TCP packets
    res.socket?.setNoDelay(true);

    const abortController = new AbortController();
    let clientDisconnected = false;

    req.on('close', () => {
      clientDisconnected = true;
      abortController.abort();
    });

    const sendEvent = (type: ChatSSEEventType, data: string): void => {
      if (clientDisconnected) return;
      res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
      // Flush any middleware buffers (compression, etc.) to ensure the
      // event reaches the client immediately
      flushableRes.flush?.();
    };

    try {
      // Get or create conversation
      let conversationId = params.conversationId;
      let isNewConversation = false;

      if (conversationId) {
        // Verify conversation exists and caller has access
        const existing = await this.conversationService.getConversation(conversationId);

        // Block public callers from accessing admin conversations
        if (existing.accessLevel === 'admin' && accessLevel !== 'admin') {
          sendEvent('error', 'You do not have access to this conversation.');
          res.end();
          return;
        }

        // Block unauthenticated callers from accessing owned conversations
        if (existing.userId && (!userId || existing.userId !== userId)) {
          sendEvent('error', 'You do not have access to this conversation.');
          res.end();
          return;
        }
      } else {
        const conversation = await this.conversationService.createConversation(userId, accessLevel);
        conversationId = conversation.id;
        isNewConversation = true;
      }

      sendEvent('conversation_id', conversationId);

      // Persist user message
      await this.conversationService.addMessage(conversationId, {
        role: 'user',
        content: message,
      });

      // Build conversation history for AI context
      const fullConversation = await this.conversationService.getConversation(conversationId);
      const conversationMessages = this.buildAiMessages(fullConversation.messages);

      // Run the agentic loop and stream results
      for await (const event of this.chatAiService.streamChatWithPersistence(conversationMessages, accessLevel, abortController.signal)) {
        if (clientDisconnected) return;

        if (event.type === 'done' && event._newMessages) {
          // Persist all new messages (tool calls, tool results, final assistant)
          for (const msg of event._newMessages) {
            await this.conversationService.addMessage(conversationId, {
              role: msg.role,
              content: msg.content ?? null,
              toolCalls: msg.tool_calls ?? null,
              toolCallId: msg.tool_call_id ?? null,
              toolName: msg.name ?? null,
            });
          }

          // Generate title for new conversations
          if (isNewConversation) {
            const title = this.generateTitle(message);
            await this.conversationService.updateTitle(conversationId, title);
            sendEvent('title', title);
          }

          sendEvent('done', '');
        } else {
          sendEvent(event.type as ChatSSEEventType, event.data);
        }
      }
    } catch (err) {
      if (clientDisconnected) return;
      serverLogger.error({ err }, 'Chat streaming failed');
      sendEvent('error', this.toUserFriendlyError(err instanceof Error ? err : new Error(String(err))));
    } finally {
      if (!clientDisconnected) {
        res.end();
      }
    }
  }

  /** Derive access level from the user's role assignments — any editor+ gets admin chat access. */
  private resolveAccessLevel(req: Request): ChatAccessLevel {
    const roles = (req.dbUser?.userRoleAssignments as UserRoleAssignment[] | undefined) ?? [];
    const isAdmin = roles.some((r) => r.role === UserRole.SUPER_ADMIN || r.role === UserRole.PRODUCT_ADMIN || r.role === UserRole.EDITOR);
    return isAdmin ? 'admin' : 'public';
  }

  /** Convert Prisma DB messages to OpenAI-compatible messages for the AI context window. */
  private buildAiMessages(dbMessages: PrismaChatMessage[]): OpenAIToolChatMessage[] {
    const messages: OpenAIToolChatMessage[] = [];

    for (const msg of dbMessages) {
      // Skip system messages — they're added fresh by the AI service
      if (msg.role === 'system') continue;

      // Cap context window
      if (messages.length >= CHAT_CONFIG.MAX_CONVERSATION_MESSAGES) break;

      const aiMsg: OpenAIToolChatMessage = {
        role: msg.role as 'user' | 'assistant' | 'tool',
        content: msg.content,
      };

      // Prisma stores toolCalls as JsonValue — cast to the typed OpenAI shape
      if (msg.toolCalls) {
        aiMsg.tool_calls = msg.toolCalls as OpenAIToolCall[];
      }
      if (msg.toolCallId) {
        aiMsg.tool_call_id = msg.toolCallId;
      }
      if (msg.toolName) {
        aiMsg.name = msg.toolName;
      }

      messages.push(aiMsg);
    }

    return messages;
  }

  private generateTitle(message: string): string {
    // Simple title from the first user message — truncate to 60 chars
    const clean = message.replace(/\n/g, ' ').trim();
    return clean.length > 60 ? clean.slice(0, 57) + '...' : clean;
  }

  private toUserFriendlyError(error: Error): string {
    const raw = error.message;

    if (raw.includes('LITELLM_API_KEY is not configured')) {
      return 'AI service is not configured. Please contact an administrator.';
    }
    if (raw.includes('timed out')) {
      return 'The AI service took too long to respond. Please try again.';
    }
    if (raw.includes('was cancelled') || raw.includes('AbortError')) {
      return 'Response was cancelled.';
    }
    if (/LiteLLM returned [45]\d\d/.test(raw)) {
      return 'The AI service is temporarily unavailable. Please try again later.';
    }

    return 'Something went wrong. Please try again.';
  }
}
