// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, inject, input, Signal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '@components/button/button.component';
import { SelectComponent } from '@components/select/select.component';
import { ContributorService } from '@services/contributor.service';
import { DialogService } from '@services/dialog.service';
import { ToastService } from '@services/toast.service';
import { catchError, of, tap } from 'rxjs';

import type { ContributorWithRelations, SlackWorkspaceUser } from '@lfx-changelog/shared';
import type { SelectOption } from '@shared/interfaces/form.interface';

@Component({
  selector: 'lfx-link-slack-dialog',
  imports: [ReactiveFormsModule, ButtonComponent, SelectComponent],
  templateUrl: './link-slack-dialog.component.html',
  styleUrl: './link-slack-dialog.component.css',
})
export class LinkSlackDialogComponent {
  private readonly contributorService = inject(ContributorService);
  private readonly toastService = inject(ToastService);
  protected readonly dialogService = inject(DialogService);

  public readonly contributor = input.required<ContributorWithRelations>();

  protected readonly slackUserControl = new FormControl('', { nonNullable: true });

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');

  protected readonly slackUsers = toSignal(
    this.contributorService.getSlackWorkspaceUsers().pipe(
      catchError(() => {
        this.error.set('Could not load the Slack workspace directory. Check that the Slack bot is installed in Admin → Settings.');
        return of([] as SlackWorkspaceUser[]);
      }),
      tap(() => this.loading.set(false))
    ),
    { initialValue: [] as SlackWorkspaceUser[] }
  );

  protected readonly slackUserOptions: Signal<SelectOption[]> = this.initSlackUserOptions();

  protected save(): void {
    const slackUserId = this.slackUserControl.value;
    if (!slackUserId) {
      this.error.set('Select a Slack user to link.');
      return;
    }

    this.error.set('');
    this.saving.set(true);
    this.contributorService.linkSlack(this.contributor().id, slackUserId).subscribe({
      next: () => {
        this.toastService.success(`Linked ${this.contributor().githubLogin} to Slack`);
        this.dialogService.close('saved');
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const message = (err as { error?: { error?: string } })?.error?.error;
        this.error.set(message || 'Failed to link the Slack user');
      },
    });
  }

  private initSlackUserOptions(): Signal<SelectOption[]> {
    return computed(() =>
      this.slackUsers().map((user) => {
        const name = user.realName || user.displayName || user.name;
        return { label: user.email ? `${name} (${user.email})` : name, value: user.id };
      })
    );
  }
}
