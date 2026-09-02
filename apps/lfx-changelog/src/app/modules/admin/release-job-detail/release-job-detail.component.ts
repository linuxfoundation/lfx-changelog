// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonComponent } from '@components/button/button.component';
import { ReleaseJobService } from '@services/release-job.service';
import { catchError, filter, interval, map, of, startWith, switchMap } from 'rxjs';

import type { ReleaseJob, ReleaseProgressLine } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-release-job-detail',
  imports: [RouterLink, ButtonComponent],
  templateUrl: './release-job-detail.component.html',
  styleUrl: './release-job-detail.component.css',
})
export class ReleaseJobDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly releaseJobService = inject(ReleaseJobService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly busy = signal(false);
  protected readonly log = signal<ReleaseProgressLine[]>([]);
  protected readonly job = this.initJob();
  protected readonly canCancel = computed(() => this.job()?.status === 'waiting_for_approval');
  protected readonly canRetry = computed(() => this.job()?.status === 'failed');
  protected readonly canRefresh = computed(() => this.job()?.status === 'completed');

  protected cancel(): void {
    const job = this.job();
    if (!job || this.busy()) return;
    this.busy.set(true);
    this.releaseJobService
      .cancel(job.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.busy.set(false),
        error: () => this.busy.set(false),
      });
  }

  protected retry(): void {
    const job = this.job();
    if (!job || this.busy()) return;
    this.busy.set(true);
    this.releaseJobService
      .retry(job.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.busy.set(false),
        error: () => this.busy.set(false),
      });
  }

  protected refreshSync(): void {
    const job = this.job();
    if (!job || this.busy()) return;
    this.busy.set(true);
    this.releaseJobService
      .refreshSync(job.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.busy.set(false),
        error: () => this.busy.set(false),
      });
  }

  private initJob() {
    return toSignal(
      this.route.paramMap.pipe(
        map((params) => params.get('id')),
        filter((id): id is string => !!id),
        switchMap((id) =>
          this.releaseJobService.getById(id).pipe(
            catchError(() => of(null as ReleaseJob | null)),
            switchMap((job) => {
              if (!job) return of(null);
              this.log.set((job.progressLog ?? []) as ReleaseProgressLine[]);
              const live = this.releaseJobService.streamJob(job.id).pipe(
                catchError(() =>
                  interval(4000).pipe(
                    startWith(0),
                    switchMap(() => this.releaseJobService.getById(job.id)),
                    map((latest) => ({ type: 'status' as const, data: latest }))
                  )
                )
              );
              live.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
                if (event.type === 'progress') {
                  this.log.update((lines) =>
                    lines.some((line) => line.timestamp === event.data.timestamp && line.summary === event.data.summary) ? lines : [...lines, event.data]
                  );
                }
              });
              return this.releaseJobService.getById(id).pipe(
                catchError(() => of(job)),
                switchMap((latest) =>
                  interval(5000).pipe(
                    startWith(0),
                    switchMap(() => this.releaseJobService.getById(id).pipe(catchError(() => of(latest))))
                  )
                )
              );
            })
          )
        )
      ),
      { initialValue: null as ReleaseJob | null }
    );
  }
}
