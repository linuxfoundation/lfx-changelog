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

  protected readonly state: Signal<SlackDialogState> = this.initState();
  protected readonly loading = computed(() => this.state().loading);
  protected readonly hasIntegration = computed(() => !!this.state().integration);
  protected readonly channelOptions = computed<SelectOption[]>(() =>
    this.state().channels.map((ch) => ({
      label: `${ch.isPrivate ? '' : '#'}${ch.name}`,
      value: ch.id,
    }))
  );

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
    const loadingState = { loading: true, integration: null, channels: [] };
    const empty = { loading: false, integration: null, channels: [] };

    return toSignal(
      toObservable(this.visible).pipe(
        filter((v) => v),
        tap(() => {
          this.error.set('');
          this.success.set(false);
          this.channelControl.setValue('');
        }),
        switchMap(() =>
          concat(
            of(loadingState),
            this.slackService.getIntegrations().pipe(
              switchMap((integrations) => {
                const active = integrations.find((i) => i.status === 'active') ?? null;
                if (!active) return of({ loading: false, integration: null, channels: [] });

                // Pre-select default channel
                const defaultChannel = active.channels?.find((ch) => ch.isDefault);
                if (defaultChannel) {
                  this.channelControl.setValue(defaultChannel.channelId);
                }

                return this.slackService.getChannels(active.id).pipe(
                  map((channels) => ({ loading: false, integration: active, channels })),
                  catchError(() => of({ loading: false, integration: active, channels: [] }))
                );
              }),
              catchError(() => of(empty))
            )
          )
        )
      ),
      { initialValue: empty }
    );
  }
}
