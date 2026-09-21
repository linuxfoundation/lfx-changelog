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
import { catchError, combineLatest, debounceTime, distinctUntilChanged, filter, map, of, startWith, switchMap, tap } from 'rxjs';

import type { GeneratedReleaseNotes, ProductRepository, ReleaseChanges, ReleaseTarget } from '@lfx-changelog/shared';
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

  // The dialog needs nothing beyond the id and full name.
  public readonly repository = input.required<ProductRepository>();

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

  // Set the moment the tag or target changes, before the debounce, so Publish is blocked from
  // that instant rather than 500ms later when the request finally starts.
  private readonly notesPending = signal(false);

  protected readonly target = signal<ReleaseTarget | null>(null);
  protected readonly changes = signal<ReleaseChanges | null>(null);
  protected readonly loadingChanges = signal(false);
  protected readonly branchOptions: Signal<SelectOption[]> = this.initBranchOptions();
  protected readonly canPublish: Signal<boolean> = this.initCanPublish();

  public constructor() {
    this.loadTarget();
    this.loadChanges();
    this.autoFillNotes();
    this.trackManualNoteEdits();
  }

  protected publish(): void {
    if (!this.canPublish()) return;

    this.error.set('');
    this.saving.set(true);
    // Publishing creates a public tag, so the dialog refuses to be dismissed until it settles.
    // takeUntilDestroyed is belt-and-braces: a destroyed dialog must never reach the shared
    // DialogService and close whichever dialog happens to be open by then.
    this.dialogService.busy.set(true);

    this.releaseService
      .createRelease(this.repository().id, {
        tagName: this.tagControl.value.trim(),
        targetCommitish: this.targetControl.value,
        name: this.nameControl.value.trim(),
        body: this.bodyControl.value,
        prerelease: this.prereleaseControl.value,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (release) => {
          this.dialogService.busy.set(false);
          this.toastService.success(`Published ${release.tag_name}`);
          this.dialogService.close('created');
        },
        error: (err: unknown) => {
          this.dialogService.busy.set(false);
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

    return computed(() => !this.loading() && !this.notesPending() && tag().trim().length > 0 && target().length > 0 && name().trim().length > 0);
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

  // Reflects the selected branch, so it refetches when the target changes rather than only
  // describing the default branch the form opened on.
  private loadChanges(): void {
    this.targetControl.valueChanges
      .pipe(
        debounceTime(CreateReleaseDialogComponent.notesDebounceMs),
        distinctUntilChanged(),
        filter((target) => target.length > 0),
        tap(() => this.loadingChanges.set(true)),
        switchMap((target) =>
          this.releaseService.getChanges(this.repository().id, target).pipe(
            catchError(() => {
              // Informational only — a failure here must not block publishing.
              this.loadingChanges.set(false);
              return of(null as ReleaseChanges | null);
            })
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((changes) => {
        this.loadingChanges.set(false);
        this.changes.set(changes);
      });
  }

  private autoFillNotes(): void {
    combineLatest([
      this.tagControl.valueChanges.pipe(startWith(this.tagControl.value)),
      this.targetControl.valueChanges.pipe(startWith(this.targetControl.value)),
    ])
      .pipe(
        tap(([tag, target]) => {
          if (this.notesEdited()) return;
          this.notesPending.set(tag.trim().length > 0 && target.length > 0);
        }),
        debounceTime(CreateReleaseDialogComponent.notesDebounceMs),
        distinctUntilChanged(([tagA, targetA], [tagB, targetB]) => tagA === tagB && targetA === targetB),
        filter(([tag, target]) => tag.trim().length > 0 && target.length > 0 && !this.notesEdited()),
        switchMap(([tag, target]) => {
          this.generatingNotes.set(true);
          return this.releaseService.previewNotes(this.repository().id, tag.trim(), target).pipe(
            // A failed preview is not fatal — the author can still write notes by hand.
            catchError(() => of(null as GeneratedReleaseNotes | null)),
            map((notes) => ({ notes, tag, target }))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ notes, tag, target }) => {
        this.generatingNotes.set(false);

        // Drop a response whose inputs the form has already moved past, so a slow reply cannot
        // overwrite the notes for a tag or branch the author is no longer publishing.
        if (tag !== this.tagControl.value || target !== this.targetControl.value) return;

        this.notesPending.set(false);
        if (!notes || this.notesEdited()) return;

        this.bodyControl.setValue(notes.body, { emitEvent: false });
      });
  }

  private trackManualNoteEdits(): void {
    this.bodyControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.notesEdited.set(true);
      this.notesPending.set(false);
    });
  }

  private messageFor(err: unknown): string {
    const body = (err as { error?: { error?: string; code?: string } })?.error;

    if (body?.code === 'CONFLICT') return 'That version tag already exists on the repository. Choose a different one.';
    if (body?.code === 'GITHUB_VALIDATION_FAILED') return 'GitHub could not use that branch or version tag. Check the branch still exists and try again.';
    if (body?.code === 'GITHUB_FORBIDDEN') return 'GitHub rejected the request. The app may be missing write access to this repository.';
    if (body?.code === 'GITHUB_NOT_FOUND') return 'GitHub can no longer see this repository. The app may have lost access to it.';
    if (body?.code === 'GITHUB_RATE_LIMITED') return 'GitHub is rate limiting the app. Try again shortly.';
    if (body?.code === 'GITHUB_SERVICE_ERROR') return 'GitHub is unavailable right now. Try again shortly.';

    return body?.error || 'Something went wrong. Try again.';
  }
}
