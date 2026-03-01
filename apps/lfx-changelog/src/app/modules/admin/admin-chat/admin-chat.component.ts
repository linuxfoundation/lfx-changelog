// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component } from '@angular/core';

import { ChatPageComponent } from '@modules/chat/chat-page/chat-page.component';

@Component({
  selector: 'lfx-admin-chat',
  imports: [ChatPageComponent],
  templateUrl: './admin-chat.component.html',
  styleUrl: './admin-chat.component.css',
})
export class AdminChatComponent {}
