// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, firstValueFrom, map, of, Subject, switchMap } from 'rxjs';

import { AuthService } from '../auth/auth.service';

import type { Signal } from '@angular/core';
import type { ChatConversation, ChatConversationWithMessages, ChatMessageUI, ChatSSEEventType } from '@lfx-changelog/shared';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  private readonly conversationsRefresh$ = new Subject<void>();

  public readonly messages = signal<ChatMessageUI[]>([]);
  public readonly streaming = signal(false);
  public readonly currentStatus = signal('');
  public readonly conversationId = signal<string | null>(null);
  public readonly conversationTitle = signal('New conversation');
  public readonly conversations: Signal<ChatConversation[]> = this.initConversations();
  public readonly error = signal('');

  private abortController: AbortController | null = null;
  private charBuffer = '';
  private animFrameId: number | null = null;

  public sendMessage(message: string): void {
    this.error.set('');

    // Add user message to UI immediately
    this.messages.update((msgs) => [...msgs, { role: 'user', content: message }]);
    this.streaming.set(true);
    this.currentStatus.set('');

    this.abortController = new AbortController();
    this.streamChat(message, this.abortController.signal);
  }

  public loadConversations(): void {
    this.conversationsRefresh$.next();
  }

  public async loadConversation(id: string): Promise<void> {
    const url = this.authService.authenticated() ? `/api/chat/conversations/${id}` : `/public/api/chat/conversations/${id}`;

    try {
      const res = await firstValueFrom(this.http.get<{ success: boolean; data: ChatConversationWithMessages }>(url));

      this.conversationId.set(res.data.id);
      this.conversationTitle.set(res.data.title);

      // Only show user + assistant messages in UI
      const uiMessages: ChatMessageUI[] = res.data.messages
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content)
        .map((m) => ({
          role: m.role,
          content: m.content!,
        }));

      this.messages.set(uiMessages);
    } catch {
      this.error.set('Failed to load conversation.');
    }
  }

  public async deleteConversation(id: string): Promise<void> {
    try {
      await firstValueFrom(this.http.delete<{ success: boolean }>(`/api/chat/conversations/${id}`));
      this.conversationsRefresh$.next();
      if (this.conversationId() === id) {
        this.reset();
      }
    } catch {
      this.error.set('Failed to delete conversation.');
    }
  }

  public abort(): void {
    this.flushCharBuffer();
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.streaming.set(false);
    this.currentStatus.set('');
  }

  public reset(): void {
    this.abort();
    this.messages.set([]);
    this.conversationId.set(null);
    this.conversationTitle.set('New conversation');
    this.error.set('');
  }

  public newConversation(): void {
    this.reset();
  }

  private async streamChat(message: string, signal: AbortSignal): Promise<void> {
    const isAuthenticated = this.authService.authenticated();
    const url = isAuthenticated ? '/api/chat/send' : '/public/api/chat/send';

    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: this.conversationId() ?? undefined,
          message,
        }),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Request failed');
        this.error.set(`Server error: ${errorText}`);
        this.streaming.set(false);
        return;
      }

      if (!response.body) {
        this.error.set('No response body received');
        this.streaming.set(false);
        return;
      }

      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Add empty assistant message that will be filled by streaming content
      this.messages.update((msgs) => [...msgs, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = this.parseSSEBuffer(buffer);
        buffer = events.remaining;

        for (const event of events.parsed) {
          this.handleSSEEvent(event);
        }

        // Stop on terminal events
        if (this.error()) {
          void reader.cancel();
          return;
        }
      }

      // Handle remaining buffer
      if (buffer.trim()) {
        const finalEvents = this.parseSSEBuffer(buffer + '\n\n');
        for (const event of finalEvents.parsed) {
          this.handleSSEEvent(event);
        }
      }

      this.streaming.set(false);
      this.currentStatus.set('');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      this.error.set(`Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.streaming.set(false);
    } finally {
      if (reader) {
        void reader.cancel();
      }
    }
  }

  private handleSSEEvent(event: { type: ChatSSEEventType; data: string }): void {
    switch (event.type) {
      case 'conversation_id':
        this.conversationId.set(event.data);
        break;
      case 'title':
        this.conversationTitle.set(event.data);
        break;
      case 'content':
        this.charBuffer += event.data;
        this.startDraining();
        break;
      case 'tool_call':
        this.currentStatus.set(this.toolCallToStatus(event.data));
        break;
      case 'status':
        this.currentStatus.set(event.data);
        break;
      case 'done':
        this.flushCharBuffer();
        this.streaming.set(false);
        this.currentStatus.set('');
        // Refresh conversations list if authenticated
        this.loadConversations();
        break;
      case 'error':
        this.flushCharBuffer();
        this.error.set(event.data);
        this.streaming.set(false);
        this.currentStatus.set('');
        // Remove the empty assistant message
        this.messages.update((msgs) => {
          const last = msgs[msgs.length - 1];
          if (last && last.role === 'assistant' && !last.content) {
            return msgs.slice(0, -1);
          }
          return msgs;
        });
        break;
    }
  }

  private toolCallToStatus(toolName: string): string {
    switch (toolName) {
      case 'list_products':
        return 'Looking up products...';
      case 'search_changelogs':
        return 'Searching changelogs...';
      case 'get_changelog_detail':
        return 'Reading changelog details...';
      default:
        return 'Thinking...';
    }
  }

  private startDraining(): void {
    if (this.animFrameId !== null || typeof requestAnimationFrame === 'undefined') return;
    this.animFrameId = requestAnimationFrame(() => this.drainStep());
  }

  private drainStep(): void {
    this.animFrameId = null;

    if (this.charBuffer.length === 0) return;

    // Adaptive rate: drain faster when buffer is large to prevent lag
    let charsPerFrame = 2;
    if (this.charBuffer.length > 150) {
      charsPerFrame = 8;
    } else if (this.charBuffer.length > 50) {
      charsPerFrame = 4;
    }

    const chunk = this.charBuffer.slice(0, charsPerFrame);
    this.charBuffer = this.charBuffer.slice(charsPerFrame);
    this.appendToAssistantMessage(chunk);

    if (this.charBuffer.length > 0) {
      this.animFrameId = requestAnimationFrame(() => this.drainStep());
    }
  }

  private flushCharBuffer(): void {
    if (this.animFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.charBuffer.length > 0) {
      this.appendToAssistantMessage(this.charBuffer);
      this.charBuffer = '';
    }
  }

  private appendToAssistantMessage(text: string): void {
    this.messages.update((msgs) => {
      const updated = [...msgs];
      const last = updated[updated.length - 1];
      if (last && last.role === 'assistant') {
        updated[updated.length - 1] = { ...last, content: last.content + text };
      }
      return updated;
    });
  }

  private initConversations(): Signal<ChatConversation[]> {
    return toSignal(
      this.conversationsRefresh$.pipe(
        switchMap(() =>
          this.authService.authenticated()
            ? this.http.get<{ success: boolean; data: ChatConversation[] }>('/api/chat/conversations').pipe(
                map((res) => res.data),
                catchError(() => of([] as ChatConversation[]))
              )
            : of([] as ChatConversation[])
        )
      ),
      { initialValue: [] }
    );
  }

  private parseSSEBuffer(buffer: string): { parsed: { type: ChatSSEEventType; data: string }[]; remaining: string } {
    const parsed: { type: ChatSSEEventType; data: string }[] = [];
    const blocks = buffer.split('\n\n');
    const remaining = blocks.pop() || '';

    for (const block of blocks) {
      if (!block.trim()) continue;

      let eventType: ChatSSEEventType = 'status';
      let data = '';

      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim() as ChatSSEEventType;
        } else if (line.startsWith('data: ')) {
          const raw = line.slice(6);
          try {
            data = JSON.parse(raw) as string;
          } catch {
            data = raw;
          }
        }
      }

      if (data || eventType === 'done') {
        parsed.push({ type: eventType, data });
      }
    }

    return { parsed, remaining };
  }
}
