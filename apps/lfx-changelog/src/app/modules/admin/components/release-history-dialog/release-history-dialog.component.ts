// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, inject, input, Signal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ReleaseJobStatus } from '@lfx-changelog/shared';
import { ReleaseService } from '@services/release.service';
import { TimeAgoPipe } from '@shared/pipes/time-ago.pipe';
import { catchError, combineLatest, map, of, switchMap, tap } from 'rxjs';

import type { ProductRepositoryWithCount, ReleaseJobSummary, StoredRelease } from '@lfx-changelog/shared';
import type { ReleaseDeployment, ReleaseHistoryRow } from '@shared/interfaces/release.interface';

@Component({
  selector: 'lfx-release-history-dialog',
  imports: [TimeAgoPipe],
  templateUrl: './release-history-dialog.component.html',
  styleUrl: './release-history-dialog.component.css',
})
export class ReleaseHistoryDialogComponent {
  private readonly releaseService = inject(ReleaseService);

  // Carries the non-draft release count, which the truncation notice compares against.
  // RepositoryWithCounts from the repositories page extends this.
  public readonly repository = input.required<ProductRepositoryWithCount>();

  private static readonly maxReleases = 100;

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  protected readonly rows: Signal<ReleaseHistoryRow[]> = this.initRows();
  protected readonly truncated: Signal<boolean> = computed(() => this.rows().length < this.repository().releaseCount);

  // ── Private initializers ────────────────────

  private initRows(): Signal<ReleaseHistoryRow[]> {
    return toSignal(
      toObservable(this.repository).pipe(
        tap(() => {
          this.loading.set(true);
          this.failed.set(false);
        }),
        switchMap((repository) =>
          combineLatest([this.releasesFor(repository.id), this.jobsFor(repository.id)]).pipe(map(([releases, jobs]) => this.withDeployments(releases, jobs)))
        ),
        tap(() => this.loading.set(false))
      ),
      { initialValue: [] as ReleaseHistoryRow[] }
    );
  }

  // ── Private helpers ─────────────────────────

  private releasesFor(repositoryId: string) {
    return this.releaseService.getReleasesForRepository(repositoryId, ReleaseHistoryDialogComponent.maxReleases).pipe(
      catchError(() => {
        this.failed.set(true);
        return of([] as StoredRelease[]);
      })
    );
  }

  /**
   * Most tracked repositories are not releasable, and this failing must not take the history
   * with it — the releases are still readable, they simply go unannotated.
   */
  private jobsFor(repositoryId: string) {
    return this.releaseService
      .getReleaseJobsForRepository(repositoryId, ReleaseHistoryDialogComponent.maxReleases)
      .pipe(catchError(() => of([] as ReleaseJobSummary[])));
  }

  private withDeployments(releases: StoredRelease[], jobs: ReleaseJobSummary[]): ReleaseHistoryRow[] {
    const byTag = new Map(jobs.map((job) => [job.tagName, job]));
    return releases.map((release) => ({ ...release, deployment: this.describe(byTag.get(release.tagName)) }));
  }

  /**
   * What the badge says. Not the stored state verbatim: `succeeded` means the image was built
   * and the version bump dispatched, which is not the same as deployed — the Argo pull request
   * lives in a repository this application cannot see. And `failed` covers a cancelled run,
   * which is why GitHub's own conclusion is kept and read here.
   */
  private describe(job: ReleaseJobSummary | undefined): ReleaseDeployment | null {
    if (!job) return null;

    const base = { runUrl: job.workflowRunUrl, workflowName: job.workflowName, running: false };
    const neutral = 'bg-draft-bg text-draft';

    switch (job.status) {
      case ReleaseJobStatus.SUCCEEDED:
        return { ...base, label: 'Built', classes: 'bg-published-bg text-published' };
      case ReleaseJobStatus.RUNNING:
        return { ...base, running: true, label: 'Building', classes: 'bg-brand-50 text-brand-700' };
      case ReleaseJobStatus.FAILED:
        return job.conclusion === 'cancelled'
          ? { ...base, label: 'Cancelled', classes: neutral }
          : { ...base, label: 'Build failed', classes: 'bg-danger-bg text-danger-text' };
      default:
        return { ...base, label: 'Awaiting CI', classes: neutral };
    }
  }
}
