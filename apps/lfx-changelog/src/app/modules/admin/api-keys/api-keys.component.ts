// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Clipboard } from '@angular/cdk/clipboard';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { BadgeComponent } from '@components/badge/badge.component';
import { ButtonComponent } from '@components/button/button.component';
import { DialogComponent } from '@components/dialog/dialog.component';
import { InputComponent } from '@components/input/input.component';
import { SelectComponent } from '@components/select/select.component';
import { API_KEY_EXPIRATION_OPTIONS, API_KEY_SCOPES } from '@lfx-changelog/shared';
import { ApiKeyService } from '@services/api-key/api-key.service';
import { KeyStatusPipe } from '@shared/pipes/key-status/key-status.pipe';
import { ScopeColorPipe } from '@shared/pipes/scope-color/scope-color.pipe';
import { BehaviorSubject, catchError, of, switchMap, tap } from 'rxjs';

import type { ApiKey, ApiKeyScope } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-api-keys',
  imports: [DatePipe, ReactiveFormsModule, BadgeComponent, ButtonComponent, DialogComponent, InputComponent, SelectComponent, ScopeColorPipe, KeyStatusPipe],
  templateUrl: './api-keys.component.html',
  styleUrl: './api-keys.component.css',
})
export class ApiKeysComponent {
  private readonly clipboard = inject(Clipboard);
  private readonly apiKeyService = inject(ApiKeyService);
  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  // Constants exposed to template
  protected readonly scopeOptions = API_KEY_SCOPES;
  protected readonly expirationOptions = API_KEY_EXPIRATION_OPTIONS;

  // Loading state
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);

  // Data
  protected readonly keys = toSignal(
    this.refresh$.pipe(
      tap(() => this.loading.set(true)),
      switchMap(() => this.apiKeyService.getAll().pipe(catchError(() => of([] as ApiKey[])))),
      tap(() => this.loading.set(false))
    ),
    { initialValue: [] as ApiKey[] }
  );

  protected readonly activeKeys = computed(() => {
    const now = Date.now();
    return this.keys().filter((k) => !k.revokedAt && new Date(k.expiresAt).getTime() > now);
  });

  protected readonly inactiveKeys = computed(() => {
    const now = Date.now();
    return this.keys().filter((k) => k.revokedAt || new Date(k.expiresAt).getTime() <= now);
  });

  // Create dialog
  protected readonly createDialogVisible = signal(false);
  protected readonly nameControl = new FormControl('', { nonNullable: true });
  protected readonly expirationControl = new FormControl('90', { nonNullable: true });
  protected readonly scopeControls: Record<string, FormControl<boolean>> = {
    'changelogs:read': new FormControl(false, { nonNullable: true }),
    'changelogs:write': new FormControl(false, { nonNullable: true }),
    'products:read': new FormControl(false, { nonNullable: true }),
    'products:write': new FormControl(false, { nonNullable: true }),
  };

  // Show-once key dialog
  protected readonly keyCreatedDialogVisible = signal(false);
  protected readonly createdRawKey = signal('');
  protected readonly keyCopied = signal(false);

  // Revoke dialog
  protected readonly revokeDialogVisible = signal(false);
  protected readonly keyToRevoke = signal<ApiKey | null>(null);

  // Inactive keys toggle
  protected readonly showInactive = signal(false);

  protected openCreate(): void {
    this.nameControl.setValue('');
    this.expirationControl.setValue('90');
    Object.values(this.scopeControls).forEach((c) => c.setValue(false));
    this.createDialogVisible.set(true);
  }

  protected createKey(): void {
    const scopes = Object.entries(this.scopeControls)
      .filter(([, control]) => control.value)
      .map(([scope]) => scope as ApiKeyScope);

    if (!this.nameControl.value.trim() || scopes.length === 0) {
      return;
    }

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
          this.createDialogVisible.set(false);
          this.createdRawKey.set(result.rawKey);
          this.keyCopied.set(false);
          this.keyCreatedDialogVisible.set(true);
          this.refresh$.next();
        },
        error: () => {
          this.saving.set(false);
        },
      });
  }

  protected closeKeyCreatedDialog(): void {
    this.keyCreatedDialogVisible.set(false);
    this.createdRawKey.set('');
  }

  protected copyKey(): void {
    const success = this.clipboard.copy(this.createdRawKey());
    if (success) {
      this.keyCopied.set(true);
    }
  }

  protected openRevoke(key: ApiKey): void {
    this.keyToRevoke.set(key);
    this.revokeDialogVisible.set(true);
  }

  protected confirmRevoke(): void {
    const key = this.keyToRevoke();
    if (!key) return;

    this.apiKeyService.revoke(key.id).subscribe({
      next: () => {
        this.revokeDialogVisible.set(false);
        this.keyToRevoke.set(null);
        this.refresh$.next();
      },
    });
  }
}
