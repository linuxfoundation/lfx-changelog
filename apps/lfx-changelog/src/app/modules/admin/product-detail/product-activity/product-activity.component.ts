// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { DatePipe, SlicePipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, Signal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CardComponent } from '@components/card/card.component';
import { ProductService } from '@services/product/product.service';
import { FirstLinePipe } from '@shared/pipes/first-line/first-line.pipe';
import { catchError, map, of, startWith, Subject, switchMap } from 'rxjs';

import type { ProductActivity } from '@lfx-changelog/shared';
import type { LoadingState } from '@shared/interfaces/loading-state.interface';

@Component({
  selector: 'lfx-product-activity',
  imports: [DatePipe, SlicePipe, CardComponent, FirstLinePipe],
  templateUrl: './product-activity.component.html',
  styleUrl: './product-activity.component.css',
})
export class ProductActivityComponent implements OnInit {
  private readonly productService = inject(ProductService);

  public readonly productId = input.required<string>();

  private readonly fetchActivity$ = new Subject<void>();

  protected readonly activityTab = signal<'releases' | 'pulls' | 'commits'>('releases');
  protected readonly releasesExpanded = signal(false);
  protected readonly commitsExpanded = signal(false);
  protected readonly pullsExpanded = signal(false);

  private readonly activityState: Signal<LoadingState<ProductActivity>> = this.initActivityState();
  protected readonly releases = computed(() => this.activityState().data.releases);
  protected readonly pullRequests = computed(() => this.activityState().data.pullRequests);
  protected readonly commits = computed(() => this.activityState().data.commits);
  protected readonly loadingActivity = computed(() => this.activityState().loading);
  protected readonly visibleReleases = computed(() => (this.releasesExpanded() ? this.releases() : this.releases().slice(0, 5)));
  protected readonly visiblePullRequests = computed(() => (this.pullsExpanded() ? this.pullRequests() : this.pullRequests().slice(0, 5)));
  protected readonly visibleCommits = computed(() => (this.commitsExpanded() ? this.commits() : this.commits().slice(0, 5)));

  public ngOnInit(): void {
    this.fetchActivity$.next();
  }

  private initActivityState(): Signal<LoadingState<ProductActivity>> {
    const empty: ProductActivity = { releases: [], pullRequests: [], commits: [] };
    return toSignal(
      this.fetchActivity$.pipe(
        switchMap(() =>
          this.productService.getActivity(this.productId()).pipe(
            map((data) => ({ data, loading: false })),
            catchError(() => of({ data: empty, loading: false })),
            startWith({ data: empty, loading: true })
          )
        )
      ),
      { initialValue: { data: empty, loading: false } }
    );
  }
}
