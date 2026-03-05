// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, inject, input } from '@angular/core';
import { ButtonComponent } from '@components/button/button.component';
import { ApiKeyService } from '@services/api-key/api-key.service';
import { DialogService } from '@services/dialog/dialog.service';

import type { ApiKey } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-revoke-api-key-dialog',
  imports: [ButtonComponent],
  templateUrl: './revoke-api-key-dialog.component.html',
  styleUrl: './revoke-api-key-dialog.component.css',
})
export class RevokeApiKeyDialogComponent {
  private readonly apiKeyService = inject(ApiKeyService);
  protected readonly dialogService = inject(DialogService);

  public readonly key = input.required<ApiKey>();

  protected confirm(): void {
    this.apiKeyService.revoke(this.key().id).subscribe({
      next: () => this.dialogService.close('revoked'),
    });
  }
}
