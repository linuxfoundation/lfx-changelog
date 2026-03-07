// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, inject, input, signal, Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '@components/button/button.component';
import { SelectComponent } from '@components/select/select.component';
import { DialogService } from '@services/dialog.service';
import { IntegrationsService } from '@services/integrations.service';
import { catchError, concat, filter, map, of, switchMap, tap } from 'rxjs';

import type { SlackChannelOption } from '@lfx-changelog/shared';
import type { SelectOption } from '@shared/interfaces/form.interface';
import type { SlackDialogState } from '@shared/interfaces/slack.interface';

@Component({
  selector: 'lfx-post-to-slack-dialog',
  imports: [ReactiveFormsModule, ButtonComponent, SelectComponent],
  templateUrl: './post-to-slack-dialog.component.html',
  styleUrl: './post-to-slack-dialog.component.css',
})
export class PostToSlackDialogComponent {
  private readonly integrationsService = inject(IntegrationsService);
  protected readonly dialogService = inject(DialogService);

  public readonly changelogId = input.required<string>();
  public readonly changelogTitle = input('');
  public readonly onPosted = input<(channelName: string) => void>();

  protected readonly channelControl = new FormControl('', { nonNullable: true });
  protected readonly posting = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal(false);
  protected readonly showChannelPicker = signal(false);
  protected readonly channelsLoading = signal(false);

  protected readonly state: Signal<SlackDialogState> = this.initState();
  protected readonly loading = computed(() => this.state().loading);
  protected readonly hasIntegration = computed(() => !!this.state().integration);

  protected readonly defaultChannelName = computed(() => {
    const integration = this.state().integration;
    const defaultCh = integration?.channels?.find((ch) => ch.isDefault);
    return defaultCh?.channelName ?? null;
  });

  protected readonly channels: Signal<SlackChannelOption[]> = this.initChannels();
  protected readonly channelOptions = computed<SelectOption[]>(() =>
    this.channels().map((ch) => ({
      label: `${ch.isPrivate ? '' : '#'}${ch.name}`,
      value: ch.id,
    }))
  );

  protected openChannelPicker(): void {
    this.showChannelPicker.set(true);
  }

  protected postToSlack(): void {
    const channelId = this.channelControl.value;
    if (!channelId) return;

    const channelName = this.resolveChannelName(channelId);

    this.posting.set(true);
    this.error.set('');

    this.integrationsService.postToSlack(this.changelogId(), channelId, channelName).subscribe({
      next: (res) => {
        this.posting.set(false);
        this.success.set(true);
        this.onPosted()?.(res.channelName);
      },
      error: () => {
        this.posting.set(false);
        this.error.set('Failed to post to Slack. Please try again.');
      },
    });
  }

  private resolveChannelName(channelId: string): string {
    const fromPicker = this.channels().find((ch) => ch.id === channelId);
    if (fromPicker) return fromPicker.name;

    const integration = this.state().integration;
    const saved = integration?.channels?.find((ch) => ch.channelId === channelId);
    if (saved) return saved.channelName;

    return channelId;
  }

  private initState() {
    const loadingState: SlackDialogState = { loading: true, integration: null };
    const empty: SlackDialogState = { loading: false, integration: null };

    // Component is created when dialog opens — load immediately
    return toSignal(
      concat(
        of(loadingState),
        this.integrationsService.getSlackIntegrations().pipe(
          map((integrations) => {
            const active = integrations.find((i) => i.status === 'active') ?? null;

            if (active) {
              const defaultChannel = active.channels?.find((ch) => ch.isDefault);
              if (defaultChannel) {
                this.channelControl.setValue(defaultChannel.channelId);
              }
            }

            return { loading: false, integration: active } as SlackDialogState;
          }),
          catchError(() => of(empty))
        )
      ),
      { initialValue: loadingState }
    );
  }

  private initChannels(): Signal<SlackChannelOption[]> {
    return toSignal(
      toObservable(this.showChannelPicker).pipe(
        filter((show) => show),
        tap(() => this.channelsLoading.set(true)),
        switchMap(() => {
          const integration = this.state().integration;
          if (!integration) return of([] as SlackChannelOption[]);
          return this.integrationsService.getSlackChannels(integration.id).pipe(catchError(() => of([] as SlackChannelOption[])));
        }),
        tap(() => this.channelsLoading.set(false))
      ),
      { initialValue: [] as SlackChannelOption[] }
    );
  }
}
