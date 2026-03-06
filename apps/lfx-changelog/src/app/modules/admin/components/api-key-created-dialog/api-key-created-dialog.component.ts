// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Clipboard } from '@angular/cdk/clipboard';
import { Component, inject, input, signal } from '@angular/core';
import { ButtonComponent } from '@components/button/button.component';
import { DialogService } from '@services/dialog/dialog.service';
import { ToastService } from '@services/toast/toast.service';

@Component({
  selector: 'lfx-api-key-created-dialog',
  imports: [ButtonComponent],
  templateUrl: './api-key-created-dialog.component.html',
  styleUrl: './api-key-created-dialog.component.css',
})
export class ApiKeyCreatedDialogComponent {
  private readonly clipboard = inject(Clipboard);
  private readonly toastService = inject(ToastService);
  protected readonly dialogService = inject(DialogService);

  public readonly rawKey = input.required<string>();

  protected readonly copied = signal(false);

  protected copyKey(): void {
    const success = this.clipboard.copy(this.rawKey());
    if (success) {
      this.copied.set(true);
      this.toastService.success('API key copied to clipboard');
    }
  }
}
