// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BadgeComponent } from '@components/badge/badge.component';
import { ButtonComponent } from '@components/button/button.component';
import { ApiKeyCreatedDialogComponent } from '@modules/admin/components/api-key-created-dialog/api-key-created-dialog.component';
import { CreateApiKeyDialogComponent } from '@modules/admin/components/create-api-key-dialog/create-api-key-dialog.component';
import { RevokeApiKeyDialogComponent } from '@modules/admin/components/revoke-api-key-dialog/revoke-api-key-dialog.component';
import { ApiKeyService } from '@services/api-key/api-key.service';
import { DialogService } from '@services/dialog/dialog.service';
import { KeyStatusPipe } from '@shared/pipes/key-status/key-status.pipe';
import { ScopeColorPipe } from '@shared/pipes/scope-color/scope-color.pipe';
import { BehaviorSubject, catchError, of, switchMap, tap } from 'rxjs';

import type { ApiKey } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-api-keys',
  imports: [DatePipe, BadgeComponent, ButtonComponent, ScopeColorPipe, KeyStatusPipe],
  templateUrl: './api-keys.component.html',
  styleUrl: './api-keys.component.css',
})
export class ApiKeysComponent {
  private readonly apiKeyService = inject(ApiKeyService);
  private readonly dialogService = inject(DialogService);
  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  protected readonly loading = signal(true);

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

  protected readonly showInactive = signal(false);

  protected openCreate(): void {
    this.dialogService.open({
      title: 'Create API Key',
      component: CreateApiKeyDialogComponent,
      testId: 'api-key-create-dialog',
      onClose: (result) => {
        if (result && typeof result === 'object' && 'action' in result && 'rawKey' in result && result.action === 'created') {
          this.refresh$.next();
          // Open the "key created" dialog to show the raw key
          this.dialogService.open({
            title: 'API Key Created',
            component: ApiKeyCreatedDialogComponent,
            inputs: { rawKey: result.rawKey as string },
            testId: 'api-key-created-dialog',
          });
        }
      },
    });
  }

  protected openRevoke(key: ApiKey): void {
    this.dialogService.open({
      title: 'Revoke API Key',
      component: RevokeApiKeyDialogComponent,
      inputs: { key },
      testId: 'api-key-revoke-dialog',
      onClose: (result) => {
        if (result === 'revoked') this.refresh$.next();
      },
    });
  }
}
