// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { BadgeComponent } from '@components/badge/badge.component';
import { ButtonComponent } from '@components/button/button.component';
import { InputComponent } from '@components/input/input.component';
import { SelectComponent } from '@components/select/select.component';
import { API_KEY_EXPIRATION_OPTIONS, API_KEY_SCOPES } from '@lfx-changelog/shared';
import { ApiKeyService } from '@services/api-key/api-key.service';
import { DialogService } from '@services/dialog/dialog.service';
import { ToastService } from '@services/toast/toast.service';

import type { ApiKeyScope } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-create-api-key-dialog',
  imports: [ReactiveFormsModule, BadgeComponent, ButtonComponent, InputComponent, SelectComponent],
  templateUrl: './create-api-key-dialog.component.html',
  styleUrl: './create-api-key-dialog.component.css',
})
export class CreateApiKeyDialogComponent {
  private readonly apiKeyService = inject(ApiKeyService);
  private readonly toastService = inject(ToastService);
  protected readonly dialogService = inject(DialogService);

  protected readonly scopeOptions = API_KEY_SCOPES;
  protected readonly expirationOptions = API_KEY_EXPIRATION_OPTIONS;

  protected readonly nameControl = new FormControl('', { nonNullable: true });
  protected readonly expirationControl = new FormControl('90', { nonNullable: true });
  protected readonly scopeControls: Record<string, FormControl<boolean>> = {
    'changelogs:read': new FormControl(false, { nonNullable: true }),
    'changelogs:write': new FormControl(false, { nonNullable: true }),
    'products:read': new FormControl(false, { nonNullable: true }),
    'products:write': new FormControl(false, { nonNullable: true }),
  };

  protected readonly saving = signal(false);

  protected create(): void {
    const scopes = Object.entries(this.scopeControls)
      .filter(([, control]) => control.value)
      .map(([scope]) => scope as ApiKeyScope);

    if (!this.nameControl.value.trim() || scopes.length === 0) return;

    this.saving.set(true);
    this.apiKeyService
      .create({
        name: this.nameControl.value.trim(),
        scopes,
        expiresInDays: parseInt(this.expirationControl.value, 10),
      })
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          this.toastService.success('API key created');
          this.dialogService.close({ action: 'created', rawKey: result.rawKey });
        },
        error: () => {
          this.saving.set(false);
          this.toastService.error('Failed to create API key');
        },
      });
  }
}
