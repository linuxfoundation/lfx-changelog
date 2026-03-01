// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component } from '@angular/core';

import { ChatPageComponent } from '@modules/chat/chat-page/chat-page.component';

@Component({
  selector: 'lfx-public-chat',
  imports: [ChatPageComponent],
  templateUrl: './public-chat.component.html',
  styleUrl: './public-chat.component.css',
})
export class PublicChatComponent {}
