// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal, Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonComponent } from '@components/button/button.component';
import { CardComponent } from '@components/card/card.component';
import { DialogComponent } from '@components/dialog/dialog.component';
import { SelectComponent } from '@components/select/select.component';
import { SlackService } from '@services/slack/slack.service';
import { BehaviorSubject, catchError, filter, of, switchMap, tap } from 'rxjs';

import type { SlackChannelOption, SlackIntegration } from '@lfx-changelog/shared';
import type { SelectOption } from '@shared/interfaces/form.interface';

@Component({
  selector: 'lfx-user-settings',
  imports: [DatePipe, ReactiveFormsModule, ButtonComponent, CardComponent, DialogComponent, SelectComponent],
  templateUrl: './user-settings.component.html',
  styleUrl: './user-settings.component.css',
})
export class UserSettingsComponent {
  private readonly slackService = inject(SlackService);
  private readonly route = inject(ActivatedRoute);
  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  protected readonly loading = signal(true);
  protected readonly channelsLoading = signal(false);
  protected readonly savingChannel = signal(false);
  protected readonly disconnecting = signal(false);

  protected readonly channelControl = new FormControl('', { nonNullable: true });

  // OAuth callback query params
  protected readonly slackConnected = computed(() => this.route.snapshot.queryParamMap.get('slack_connected') === 'true');
  protected readonly slackError = computed(() => this.route.snapshot.queryParamMap.get('slack_error'));

  // Integrations data
  protected readonly integrations = toSignal(
    this.refresh$.pipe(
      tap(() => this.loading.set(true)),
      switchMap(() => this.slackService.getIntegrations().pipe(catchError(() => of([] as SlackIntegration[])))),
      tap(() => this.loading.set(false))
    ),
    { initialValue: [] as SlackIntegration[] }
  );

  protected readonly hasIntegration = computed(() => this.integrations().length > 0);
  protected readonly activeIntegration = computed(() => this.integrations().find((i) => i.status === 'active'));

  // Channel picker — auto-loads when active integration is available
  protected readonly channels: Signal<SlackChannelOption[]> = this.initChannels();
  protected readonly channelOptions = computed<SelectOption[]>(() =>
    this.channels().map((ch) => ({
      label: `${ch.isPrivate ? '' : '#'}${ch.name}`,
      value: ch.id,
    }))
  );

  // Disconnect dialog
  protected readonly disconnectDialogVisible = signal(false);

  protected connectSlack(): void {
    this.slackService.connect();
  }

  protected saveChannel(): void {
    const integration = this.activeIntegration();
    if (!integration) return;

    const channelId = this.channelControl.value;
    const channel = this.channels().find((ch) => ch.id === channelId);
    if (!channelId || !channel) return;

    this.savingChannel.set(true);
    this.slackService.saveChannel(integration.id, channelId, channel.name).subscribe({
      next: () => {
        this.savingChannel.set(false);
        this.refresh$.next();
      },
      error: () => this.savingChannel.set(false),
    });
  }

  protected openDisconnectDialog(): void {
    this.disconnectDialogVisible.set(true);
  }

  protected confirmDisconnect(): void {
    const integration = this.activeIntegration();
    if (!integration) return;

    this.disconnecting.set(true);
    this.slackService.disconnect(integration.id).subscribe({
      next: () => {
        this.disconnecting.set(false);
        this.disconnectDialogVisible.set(false);
        this.channelControl.setValue('');
        this.refresh$.next();
      },
      error: () => this.disconnecting.set(false),
    });
  }

  private initChannels(): Signal<SlackChannelOption[]> {
    return toSignal(
      toObservable(this.activeIntegration).pipe(
        filter((integration): integration is SlackIntegration => !!integration),
        tap(() => this.channelsLoading.set(true)),
        switchMap((integration) => this.slackService.getChannels(integration.id).pipe(catchError(() => of([] as SlackChannelOption[])))),
        tap(() => this.channelsLoading.set(false))
      ),
      { initialValue: [] as SlackChannelOption[] }
    );
  }
}
