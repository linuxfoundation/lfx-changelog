// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, inject, input, signal } from '@angular/core';
import { ButtonComponent } from '@components/button/button.component';
import { DialogService } from '@services/dialog.service';
import { IntegrationsService } from '@services/integrations.service';
import { ToastService } from '@services/toast.service';

@Component({
  selector: 'lfx-disconnect-slack-dialog',
  imports: [ButtonComponent],
  templateUrl: './disconnect-slack-dialog.component.html',
  styleUrl: './disconnect-slack-dialog.component.css',
})
export class DisconnectSlackDialogComponent {
  private readonly integrationsService = inject(IntegrationsService);
  private readonly toastService = inject(ToastService);
  protected readonly dialogService = inject(DialogService);

  public readonly integrationId = input.required<string>();

  protected readonly disconnecting = signal(false);

  protected confirm(): void {
    this.disconnecting.set(true);
    this.integrationsService.disconnectSlack(this.integrationId()).subscribe({
      next: () => {
        this.disconnecting.set(false);
        this.toastService.success('Slack disconnected');
        this.dialogService.close('disconnected');
      },
      error: () => {
        this.disconnecting.set(false);
        this.toastService.error('Failed to disconnect Slack');
      },
    });
  }
}
