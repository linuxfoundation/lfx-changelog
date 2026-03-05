// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, inject, input } from '@angular/core';
import { ButtonComponent } from '@components/button/button.component';
import { DialogService } from '@services/dialog/dialog.service';

@Component({
  selector: 'lfx-confirm-dialog',
  imports: [ButtonComponent],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.css',
})
export class ConfirmDialogComponent {
  protected readonly dialogService = inject(DialogService);

  public readonly message = input.required<string>();
  public readonly confirmLabel = input('Confirm');
  public readonly danger = input(false);

  protected confirm(): void {
    this.dialogService.close('confirmed');
  }
}
