// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, inject, input, Signal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '@components/button/button.component';
import { InputComponent } from '@components/input/input.component';
import { SelectComponent } from '@components/select/select.component';
import { ContributorService } from '@services/contributor.service';
import { DialogService } from '@services/dialog.service';
import { ToastService } from '@services/toast.service';
import { catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';

import type { ContributorWithRelations, SlackWorkspaceUser } from '@lfx-changelog/shared';
import type { SelectOption } from '@shared/interfaces/form.interface';

@Component({
  selector: 'lfx-link-slack-dialog',
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent, SelectComponent],
  templateUrl: './link-slack-dialog.component.html',
  styleUrl: './link-slack-dialog.component.css',
})
export class LinkSlackDialogComponent {
  private readonly contributorService = inject(ContributorService);
  private readonly toastService = inject(ToastService);
  protected readonly dialogService = inject(DialogService);

  public readonly contributor = input.required<ContributorWithRelations>();

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly slackUserControl = new FormControl('', { nonNullable: true });

  private static readonly minSearchLength = 2;
  private static readonly searchDebounceMs = 300;

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');

  /** Searched server-side so the workspace directory is never sent to the browser in full. */
  protected readonly slackUsers = toSignal(
    this.searchControl.valueChanges.pipe(
      debounceTime(LinkSlackDialogComponent.searchDebounceMs),
      distinctUntilChanged(),
      switchMap((term) => {
        const query = term.trim();
        if (query.length < LinkSlackDialogComponent.minSearchLength) {
          this.loading.set(false);
          return of([] as SlackWorkspaceUser[]);
        }

        this.error.set('');
        this.loading.set(true);
        return this.contributorService.searchSlackWorkspaceUsers(query).pipe(
          catchError(() => {
            this.error.set('Could not search the Slack workspace. Check that the Slack bot is installed in Admin → Settings.');
            return of([] as SlackWorkspaceUser[]);
          }),
          tap(() => this.loading.set(false))
        );
      })
    ),
    { initialValue: [] as SlackWorkspaceUser[] }
  );

  protected readonly slackUserOptions: Signal<SelectOption[]> = this.initSlackUserOptions();
  private readonly searchTerm = toSignal(this.searchControl.valueChanges, { initialValue: '' });
  protected readonly hasSearched: Signal<boolean> = computed(() => this.searchTerm().trim().length >= LinkSlackDialogComponent.minSearchLength);

  private readonly selectedSlackUserId = toSignal(this.slackUserControl.valueChanges, { initialValue: this.slackUserControl.value });
  protected readonly canSave: Signal<boolean> = computed(() => this.selectedSlackUserId().length > 0);

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
