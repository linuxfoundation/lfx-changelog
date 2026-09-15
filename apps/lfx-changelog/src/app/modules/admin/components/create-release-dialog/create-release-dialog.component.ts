// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, DestroyRef, inject, input, Signal, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '@components/button/button.component';
import { InputComponent } from '@components/input/input.component';
import { SelectComponent } from '@components/select/select.component';
import { TextareaComponent } from '@components/textarea/textarea.component';
import { DialogService } from '@services/dialog.service';
import { ReleaseService } from '@services/release.service';
import { ToastService } from '@services/toast.service';
import { catchError, combineLatest, debounceTime, distinctUntilChanged, filter, of, startWith, switchMap, tap } from 'rxjs';

import type { GeneratedReleaseNotes, ReleaseTarget, RepositoryWithCounts } from '@lfx-changelog/shared';
import type { SelectOption } from '@shared/interfaces/form.interface';

@Component({
  selector: 'lfx-create-release-dialog',
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent, SelectComponent, TextareaComponent],
  templateUrl: './create-release-dialog.component.html',
  styleUrl: './create-release-dialog.component.css',
})
export class CreateReleaseDialogComponent {
  private readonly releaseService = inject(ReleaseService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly dialogService = inject(DialogService);

  public readonly repository = input.required<RepositoryWithCounts>();

  protected readonly targetControl = new FormControl('', { nonNullable: true });
  protected readonly tagControl = new FormControl('', { nonNullable: true });
  protected readonly nameControl = new FormControl('', { nonNullable: true });
  protected readonly bodyControl = new FormControl('', { nonNullable: true });
  protected readonly prereleaseControl = new FormControl(false, { nonNullable: true });

  private static readonly notesDebounceMs = 500;

  protected readonly loading = signal(true);
  protected readonly generatingNotes = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');

  // Set once the author types in the notes field, so a later tag or target change never
  // overwrites what they wrote. Programmatic fills use emitEvent: false to stay silent.
  private readonly notesEdited = signal(false);

  protected readonly target = signal<ReleaseTarget | null>(null);
  protected readonly branchOptions: Signal<SelectOption[]> = this.initBranchOptions();
  protected readonly canPublish: Signal<boolean> = this.initCanPublish();

  public constructor() {
    this.loadTarget();
    this.autoFillNotes();
    this.trackManualNoteEdits();
  }

  protected publish(): void {
    if (!this.canPublish()) return;

    this.error.set('');
    this.saving.set(true);
    this.releaseService
      .createRelease(this.repository().id, {
        tagName: this.tagControl.value.trim(),
        targetCommitish: this.targetControl.value,
        name: this.nameControl.value.trim(),
        body: this.bodyControl.value,
        prerelease: this.prereleaseControl.value,
      })
      .subscribe({
        next: (release) => {
          this.toastService.success(`Published ${release.tag_name}`);
          this.dialogService.close('created');
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.error.set(this.messageFor(err));
        },
      });
  }

  // ── Private initializers ────────────────────

  private initBranchOptions(): Signal<SelectOption[]> {
    return computed(() => (this.target()?.branches ?? []).map((branch) => ({ label: branch.name, value: branch.name })));
  }

  private initCanPublish(): Signal<boolean> {
    const tag = toSignal(this.tagControl.valueChanges, { initialValue: this.tagControl.value });
    const target = toSignal(this.targetControl.valueChanges, { initialValue: this.targetControl.value });
    const name = toSignal(this.nameControl.valueChanges, { initialValue: this.nameControl.value });

    return computed(() => !this.loading() && tag().trim().length > 0 && target().length > 0 && name().trim().length > 0);
  }

  private loadTarget(): void {
    toObservable(this.repository)
      .pipe(
        switchMap((repository) =>
          this.releaseService.getReleaseTarget(repository.id).pipe(
            catchError((err: unknown) => {
              this.error.set(this.messageFor(err));
              this.loading.set(false);
              return of(null);
            })
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((target) => {
        if (!target) return;

        this.target.set(target);
        // Emitted, unlike the notes fill below: these drive both `canPublish` and the
        // note auto-generation, so silencing them would leave the form unsubmittable.
        this.targetControl.setValue(target.defaultBranch);
        this.tagControl.setValue(target.suggestedTag);
        this.nameControl.setValue(target.suggestedTag);
        this.loading.set(false);
      });
  }

  private autoFillNotes(): void {
    combineLatest([
      this.tagControl.valueChanges.pipe(startWith(this.tagControl.value)),
      this.targetControl.valueChanges.pipe(startWith(this.targetControl.value)),
    ])
      .pipe(
        debounceTime(CreateReleaseDialogComponent.notesDebounceMs),
        distinctUntilChanged(([tagA, targetA], [tagB, targetB]) => tagA === tagB && targetA === targetB),
        filter(([tag, target]) => tag.trim().length > 0 && target.length > 0 && !this.notesEdited()),
        tap(() => {
          this.generatingNotes.set(true);
          this.error.set('');
        }),
        switchMap(([tag, target]) =>
          this.releaseService.previewNotes(this.repository().id, tag.trim(), target).pipe(
            catchError(() => {
              // A failed preview is not fatal — the author can still write notes by hand.
              this.generatingNotes.set(false);
              return of(null as GeneratedReleaseNotes | null);
            })
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((notes) => {
        this.generatingNotes.set(false);
        if (!notes || this.notesEdited()) return;

        this.bodyControl.setValue(notes.body, { emitEvent: false });
      });
  }

  private trackManualNoteEdits(): void {
    this.bodyControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.notesEdited.set(true));
  }

  private messageFor(err: unknown): string {
    const body = (err as { error?: { error?: string; code?: string } })?.error;

    if (body?.code === 'CONFLICT') return 'That tag already exists on the repository. Choose a different tag.';
    if (body?.code === 'GITHUB_FORBIDDEN') return 'GitHub rejected the request. The app may be missing write access to this repository.';
    if (body?.code === 'GITHUB_RATE_LIMITED') return 'GitHub is rate limiting the app. Try again shortly.';

    return body?.error || 'Something went wrong. Try again.';
  }
}
