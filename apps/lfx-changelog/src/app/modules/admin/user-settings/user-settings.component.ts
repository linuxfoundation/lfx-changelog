// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, Signal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonComponent } from '@components/button/button.component';
import { CardComponent } from '@components/card/card.component';
import { SelectComponent } from '@components/select/select.component';
import { ApiKeysComponent } from '@modules/admin/api-keys/api-keys.component';
import { DisconnectSlackDialogComponent } from '@modules/admin/components/disconnect-slack-dialog/disconnect-slack-dialog.component';
import { AuthService } from '@services/auth.service';
import { DialogService } from '@services/dialog.service';
import { IntegrationsService } from '@services/integrations.service';
import { ToastService } from '@services/toast.service';
import { BehaviorSubject, catchError, filter, of, switchMap, take, tap } from 'rxjs';

import type { SlackBotInstallation, SlackChannelOption, SlackIntegration } from '@lfx-changelog/shared';
import type { SelectOption } from '@shared/interfaces/form.interface';

@Component({
  selector: 'lfx-user-settings',
  imports: [DatePipe, ReactiveFormsModule, ButtonComponent, CardComponent, SelectComponent, ApiKeysComponent],
  templateUrl: './user-settings.component.html',
  styleUrl: './user-settings.component.css',
})
export class UserSettingsComponent {
  private readonly integrationsService = inject(IntegrationsService);
  private readonly toastService = inject(ToastService);
  private readonly dialogService = inject(DialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  protected readonly isSuperAdmin = this.authService.isSuperAdmin;

  protected readonly loading = signal(true);
  protected readonly channelsLoading = signal(false);
  protected readonly savingChannel = signal(false);
  protected readonly botLoading = signal(true);

  protected readonly channelControl = new FormControl('', { nonNullable: true });

  // OAuth callback query params (reactive via observable, not snapshot)
  private readonly queryParams = toSignal(this.route.queryParamMap, { requireSync: true });
  protected readonly slackConnected = computed(() => this.queryParams().get('slack_connected') === 'true');
  protected readonly slackError = computed(() => this.queryParams().get('slack_error'));
  protected readonly slackBotConnected = computed(() => this.queryParams().get('slack_bot_connected') === 'true');
  protected readonly slackBotError = computed(() => this.queryParams().get('slack_bot_error'));

  // Integrations data
  protected readonly integrations = toSignal(
    this.refresh$.pipe(
      tap(() => this.loading.set(true)),
      switchMap(() => this.integrationsService.getSlackIntegrations().pipe(catchError(() => of([] as SlackIntegration[])))),
      tap(() => this.loading.set(false))
    ),
    { initialValue: [] as SlackIntegration[] }
  );

  protected readonly hasIntegration = computed(() => this.integrations().length > 0);
  protected readonly activeIntegration = computed(() => this.integrations().find((i) => i.status === 'active'));

  // Channel picker — loaded on demand via "Change Channel" button
  protected readonly showChannelPicker = signal(false);
  protected readonly channels: Signal<SlackChannelOption[]> = this.initChannels();
  protected readonly channelOptions = computed<SelectOption[]>(() =>
    this.channels().map((ch) => ({
      label: `${ch.isPrivate ? '' : '#'}${ch.name}`,
      value: ch.id,
    }))
  );

  protected readonly defaultChannelName = computed(() => {
    const integration = this.activeIntegration();
    const defaultCh = integration?.channels?.find((ch) => ch.isDefault);
    return defaultCh?.channelName ?? null;
  });

  // Bot installation (super admin only)
  protected readonly botInstallation: Signal<SlackBotInstallation | null> = this.initBotInstallation();

  protected connectSlack(): void {
    this.integrationsService.connectSlack();
  }

  protected connectBot(): void {
    this.integrationsService.connectBot();
  }

  protected saveChannel(): void {
    const integration = this.activeIntegration();
    if (!integration) return;

    const channelId = this.channelControl.value;
    const channel = this.channels().find((ch) => ch.id === channelId);
    if (!channelId || !channel) return;

    this.savingChannel.set(true);
    this.integrationsService.saveSlackChannel(integration.id, channelId, channel.name).subscribe({
      next: () => {
        this.savingChannel.set(false);
        this.toastService.success('Default channel saved');
        this.refresh$.next();
      },
      error: () => {
        this.savingChannel.set(false);
        this.toastService.error('Failed to save channel');
      },
    });
  }

  protected openChannelPicker(): void {
    this.showChannelPicker.set(true);
  }

  protected openDisconnectDialog(): void {
    const integration = this.activeIntegration();
    if (!integration) return;

    this.dialogService.open({
      title: 'Disconnect Slack',
      size: 'sm',
      component: DisconnectSlackDialogComponent,
      inputs: { integrationId: integration.id },
      onClose: (result) => {
        if (result === 'disconnected') {
          this.channelControl.setValue('');
          this.refresh$.next();
        }
      },
    });
  }

  private initBotInstallation(): Signal<SlackBotInstallation | null> {
    return toSignal(
      toObservable(this.isSuperAdmin).pipe(
        filter((is) => is),
        take(1),
        switchMap(() =>
          this.integrationsService.getBotInstallation().pipe(
            tap(() => this.botLoading.set(false)),
            catchError(() => {
              this.botLoading.set(false);
              return of(null);
            })
          )
        )
      ),
      { initialValue: null }
    );
  }

  private initChannels(): Signal<SlackChannelOption[]> {
    return toSignal(
      toObservable(this.showChannelPicker).pipe(
        filter((show) => show),
        tap(() => this.channelsLoading.set(true)),
        switchMap(() => {
          const integration = this.activeIntegration();
          if (!integration) return of([] as SlackChannelOption[]);
          return this.integrationsService.getSlackChannels(integration.id).pipe(catchError(() => of([] as SlackChannelOption[])));
        }),
        tap(() => this.channelsLoading.set(false))
      ),
      { initialValue: [] as SlackChannelOption[] }
    );
  }
}
