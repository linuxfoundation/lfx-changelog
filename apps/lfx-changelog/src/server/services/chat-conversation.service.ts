// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { ChatAccessLevel, Prisma } from '@prisma/client';

import { CHAT_CONFIG } from '../constants/chat.constants';
import { AuthorizationError, NotFoundError } from '../errors';
import { serverLogger } from '../server-logger';

import { getPrismaClient } from './prisma.service';

import type { AddChatMessageParams, ChatAccessLevel as ChatAccessLevelType } from '@lfx-changelog/shared';
import type { ChatConversation as PrismaChatConversation, ChatMessage as PrismaChatMessage } from '@prisma/client';

export class ChatConversationService {
  public async createConversation(userId: string | null, accessLevel: ChatAccessLevelType): Promise<PrismaChatConversation> {
    const prisma = getPrismaClient();
    try {
      return await prisma.chatConversation.create({
        data: {
          userId,
          accessLevel: accessLevel as ChatAccessLevel,
        },
      });
    } catch (error) {
      serverLogger.error({ err: error, operation: 'createConversation', service: 'chat-conversation' }, 'Prisma query failed');
      throw error;
    }
  }

  public async getConversation(id: string): Promise<PrismaChatConversation & { messages: PrismaChatMessage[] }> {
    const prisma = getPrismaClient();
    const conversation = await prisma.chatConversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: CHAT_CONFIG.MAX_CONVERSATION_MESSAGES,
        },
      },
    });
    if (!conversation) {
      throw new NotFoundError(`Conversation not found: ${id}`, { operation: 'getConversation', service: 'chat-conversation' });
    }
    return conversation;
  }

  public async listConversations(userId: string, limit = 20): Promise<PrismaChatConversation[]> {
    const prisma = getPrismaClient();
    try {
      return await prisma.chatConversation.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: Math.min(limit, 50),
      });
    } catch (error) {
      serverLogger.error({ err: error, operation: 'listConversations', service: 'chat-conversation' }, 'Prisma query failed');
      throw error;
    }
  }

  public async addMessage(conversationId: string, params: AddChatMessageParams): Promise<PrismaChatMessage> {
    const prisma = getPrismaClient();
    try {
      const message = await prisma.chatMessage.create({
        data: {
          conversationId,
          role: params.role,
          content: params.content ?? null,
          toolCalls: params.toolCalls ?? Prisma.DbNull,
          toolCallId: params.toolCallId ?? null,
          toolName: params.toolName ?? null,
        },
      });

      await prisma.chatConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      return message;
    } catch (error) {
      serverLogger.error({ err: error, operation: 'addMessage', service: 'chat-conversation' }, 'Prisma query failed');
      throw error;
    }
  }

  public async updateTitle(id: string, title: string): Promise<void> {
    const prisma = getPrismaClient();
    await prisma.chatConversation.update({
      where: { id },
      data: { title },
    });
  }

  public async deleteConversation(id: string, userId: string): Promise<void> {
    const prisma = getPrismaClient();
    const conversation = await prisma.chatConversation.findUnique({ where: { id } });
    if (!conversation) {
      throw new NotFoundError(`Conversation not found: ${id}`, { operation: 'deleteConversation', service: 'chat-conversation' });
    }
    if (conversation.userId !== userId) {
      throw new AuthorizationError('You do not own this conversation', { operation: 'deleteConversation', service: 'chat-conversation' });
    }
    await prisma.chatConversation.delete({ where: { id } });
  }
}
