// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, inject, input, model, output, signal, Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '@components/button/button.component';
import { DialogComponent } from '@components/dialog/dialog.component';
import { SelectComponent } from '@components/select/select.component';
import { SlackService } from '@services/slack/slack.service';
import { catchError, concat, filter, map, of, switchMap, tap } from 'rxjs';

import type { SlackChannelOption } from '@lfx-changelog/shared';
import type { SelectOption } from '@shared/interfaces/form.interface';
import type { SlackDialogState } from '@shared/interfaces/slack.interface';

@Component({
  selector: 'lfx-post-to-slack-dialog',
  imports: [ReactiveFormsModule, ButtonComponent, DialogComponent, SelectComponent],
  templateUrl: './post-to-slack-dialog.component.html',
  styleUrl: './post-to-slack-dialog.component.css',
})
export class PostToSlackDialogComponent {
  private readonly slackService = inject(SlackService);

  public readonly changelogId = input.required<string>();
  public readonly changelogTitle = input('');
  public readonly visible = model(false);
  public readonly posted = output<string>();

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

  // Channels loaded on demand via "Change" button
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

    this.posting.set(true);
    this.error.set('');

    this.slackService.postToSlack(this.changelogId(), channelId).subscribe({
      next: (res) => {
        this.posting.set(false);
        this.success.set(true);
        this.posted.emit(res.channelName);
      },
      error: () => {
        this.posting.set(false);
        this.error.set('Failed to post to Slack. Please try again.');
      },
    });
  }

  private initState() {
    const loadingState: SlackDialogState = { loading: true, integration: null };
    const empty: SlackDialogState = { loading: false, integration: null };

    return toSignal(
      toObservable(this.visible).pipe(
        filter((v) => v),
        tap(() => {
          this.error.set('');
          this.success.set(false);
          this.showChannelPicker.set(false);
          this.channelControl.setValue('');
        }),
        switchMap(() =>
          concat(
            of(loadingState),
            this.slackService.getIntegrations().pipe(
              map((integrations) => {
                const active = integrations.find((i) => i.status === 'active') ?? null;

                // Pre-select default channel from saved integration data
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
          )
        )
      ),
      { initialValue: empty }
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
          return this.slackService.getChannels(integration.id).pipe(catchError(() => of([] as SlackChannelOption[])));
        }),
        tap(() => this.channelsLoading.set(false))
      ),
      { initialValue: [] as SlackChannelOption[] }
    );
  }
}
