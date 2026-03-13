// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { ChatMessageComponent } from '../chat-message/chat-message.component';

import { ADMIN_COPY, PUBLIC_COPY } from '@app/shared/constants/chat.constants';
import { AuthService } from '@services/auth.service';
import { ChatService } from '@services/chat.service';

import type { Signal } from '@angular/core';
import type { ChatCopy } from '@app/shared/interfaces/chat.interface';
import type { ChatAccessLevel } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-chat-page',
  imports: [ReactiveFormsModule, ChatMessageComponent],
  templateUrl: './chat-page.component.html',
  styleUrl: './chat-page.component.css',
  host: {
    '(document:keydown.escape)': 'showHistory() && showHistory.set(false)',
  },
})
export class ChatPageComponent {
  private readonly chatService = inject(ChatService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  public readonly mode = input<ChatAccessLevel>('public');
  public readonly messageControl = new FormControl('');

  private readonly messagesContainer = viewChild<ElementRef<HTMLDivElement>>('messagesContainer');
  private autoScroll = true;

  protected readonly messages = this.chatService.messages;
  protected readonly streaming = this.chatService.streaming;
  protected readonly currentStatus = this.chatService.currentStatus;
  protected readonly conversationId = this.chatService.conversationId;
  protected readonly conversationTitle = this.chatService.conversationTitle;
  protected readonly conversations = this.chatService.conversations;
  protected readonly error = this.chatService.error;
  protected readonly authRequired = this.chatService.authRequired;
  protected readonly authenticated = this.authService.authenticated;

  protected readonly showHistory = signal(false);

  protected readonly hasMessages = computed(() => this.messages().length > 0);
  protected readonly canSend: Signal<boolean> = this.initCanSend();
  protected readonly copy = computed<ChatCopy>(() => (this.mode() === 'admin' ? ADMIN_COPY : PUBLIC_COPY));
  protected readonly loginUrl = computed(() => {
    const cid = this.conversationId();
    const returnTo = cid ? `/chat?cid=${cid}` : '/chat';
    return `/login?returnTo=${encodeURIComponent(returnTo)}`;
  });

  public constructor() {
    afterNextRender(() => {
      this.chatService.mode.set(this.mode());
      this.chatService.loadConversations();

      // Restore conversation after login redirect (cid query param)
      const cid = this.route.snapshot.queryParamMap.get('cid');
      if (cid) {
        this.chatService.loadConversation(cid);
        this.autoScroll = true;
        // Clean the query param from the URL
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
      }
    });
    this.initAutoScroll();
  }

  protected send(): void {
    const message = this.messageControl.value?.trim();
    if (!message || this.streaming()) return;

    this.chatService.sendMessage(message);
    this.messageControl.setValue('');
    this.autoScroll = true;
  }

  protected sendPrompt(prompt: string): void {
    if (this.streaming()) return;
    this.chatService.sendMessage(prompt);
    this.autoScroll = true;
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  protected onMessagesScroll(): void {
    this.autoScroll = this.isNearBottom();
  }

  protected abort(): void {
    this.chatService.abort();
  }

  protected newConversation(): void {
    this.chatService.newConversation();
    this.showHistory.set(false);
  }

  protected toggleHistory(): void {
    this.showHistory.update((v) => !v);
  }

  protected loadConversation(id: string): void {
    this.chatService.loadConversation(id);
    this.autoScroll = true;
    this.showHistory.set(false);
  }

  protected deleteConversation(event: Event, id: string): void {
    event.stopPropagation();
    this.chatService.deleteConversation(id);
  }

  private initCanSend(): Signal<boolean> {
    return toSignal(this.messageControl.valueChanges.pipe(map((v) => !!v?.trim())), { initialValue: false });
  }

  private initAutoScroll(): void {
    toObservable(this.messages)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.autoScroll && typeof window !== 'undefined') {
          setTimeout(() => this.scrollToBottom(), 0);
        }
      });
  }

  private isNearBottom(): boolean {
    const el = this.messagesContainer()?.nativeElement;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }

  private scrollToBottom(): void {
    const el = this.messagesContainer()?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }
}
