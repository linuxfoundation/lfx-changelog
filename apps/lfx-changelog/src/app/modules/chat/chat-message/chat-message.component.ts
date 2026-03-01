// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, input } from '@angular/core';
import { MarkdownRendererComponent } from '@components/markdown-renderer/markdown-renderer.component';

import type { ChatMessageUI } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-chat-message',
  imports: [MarkdownRendererComponent],
  templateUrl: './chat-message.component.html',
  styleUrl: './chat-message.component.css',
})
export class ChatMessageComponent {
  public readonly message = input.required<ChatMessageUI>();

  protected readonly isUser = computed(() => this.message().role === 'user');
  protected readonly content = computed(() => this.message().content);
}
