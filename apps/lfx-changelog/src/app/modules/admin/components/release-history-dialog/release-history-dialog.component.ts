// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, DestroyRef, inject, input, Signal, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ReleaseService } from '@services/release.service';
import { TimeAgoPipe } from '@shared/pipes/time-ago.pipe';
import { catchError, of, switchMap, tap } from 'rxjs';

import type { ProductRepositoryWithCount, StoredRelease } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-release-history-dialog',
  imports: [TimeAgoPipe],
  templateUrl: './release-history-dialog.component.html',
  styleUrl: './release-history-dialog.component.css',
})
export class ReleaseHistoryDialogComponent {
  private readonly releaseService = inject(ReleaseService);
  private readonly destroyRef = inject(DestroyRef);

  // Carries the non-draft release count, which the truncation notice compares against.
  // RepositoryWithCounts from the repositories page is assignable to this.
  public readonly repository = input.required<ProductRepositoryWithCount>();

  private static readonly maxReleases = 100;

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  protected readonly releases = toSignal(
    toObservable(this.repository).pipe(
      tap(() => {
        this.loading.set(true);
        this.failed.set(false);
      }),
      switchMap((repository) =>
        this.releaseService.getReleasesForRepository(repository.id, ReleaseHistoryDialogComponent.maxReleases).pipe(
          catchError(() => {
            this.failed.set(true);
            return of([] as StoredRelease[]);
          })
        )
      ),
      tap(() => this.loading.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ),
    { initialValue: [] as StoredRelease[] }
  );

  protected readonly truncated: Signal<boolean> = computed(() => this.releases().length < this.repository().releaseCount);
}
