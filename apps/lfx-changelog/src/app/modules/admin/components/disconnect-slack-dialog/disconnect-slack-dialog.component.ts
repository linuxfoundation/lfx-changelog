// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, inject, input, signal } from '@angular/core';
import { ButtonComponent } from '@components/button/button.component';
import { DialogService } from '@services/dialog/dialog.service';
import { SlackService } from '@services/slack/slack.service';

@Component({
  selector: 'lfx-disconnect-slack-dialog',
  imports: [ButtonComponent],
  templateUrl: './disconnect-slack-dialog.component.html',
  styleUrl: './disconnect-slack-dialog.component.css',
})
export class DisconnectSlackDialogComponent {
  private readonly slackService = inject(SlackService);
  protected readonly dialogService = inject(DialogService);

  public readonly integrationId = input.required<string>();

  protected readonly disconnecting = signal(false);

  protected confirm(): void {
    this.disconnecting.set(true);
    this.slackService.disconnect(this.integrationId()).subscribe({
      next: () => {
        this.disconnecting.set(false);
        this.dialogService.close('disconnected');
      },
      error: () => this.disconnecting.set(false),
    });
  }
}
