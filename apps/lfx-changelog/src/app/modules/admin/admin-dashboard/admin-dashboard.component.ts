// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { StatusBadgeComponent } from '@components/status-badge/status-badge.component';
import { ChangelogStatus } from '@lfx-changelog/shared';
import { ChangelogService } from '@services/changelog.service';
import { ProductService } from '@services/product.service';
import { ReleaseService } from '@services/release.service';
import { DateFormatPipe } from '@shared/pipes/date-format.pipe';
import { ProductNamePipe } from '@shared/pipes/product-name.pipe';
import { TimeAgoPipe } from '@shared/pipes/time-ago.pipe';
import { catchError, combineLatest, of, tap } from 'rxjs';

import type { ChangelogEntryWithRelations, Product } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-admin-dashboard',
  imports: [StatusBadgeComponent, RouterLink, DateFormatPipe, ProductNamePipe, TimeAgoPipe],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css',
})
export class AdminDashboardComponent {
  private readonly changelogService = inject(ChangelogService);
  private readonly productService = inject(ProductService);
  private readonly releaseService = inject(ReleaseService);

  protected readonly loading = signal(true);

  private static readonly emptyPage = { data: [] as ChangelogEntryWithRelations[], total: 0 };

  protected readonly dashboardData = toSignal(
    combineLatest({
      all: this.changelogService.getAll({ limit: 1 }).pipe(catchError(() => of(AdminDashboardComponent.emptyPage))),
      drafts: this.changelogService.getAll({ status: ChangelogStatus.DRAFT, limit: 1 }).pipe(catchError(() => of(AdminDashboardComponent.emptyPage))),
      published: this.changelogService.getAll({ status: ChangelogStatus.PUBLISHED, limit: 1 }).pipe(catchError(() => of(AdminDashboardComponent.emptyPage))),
      recent: this.changelogService.getAll({ limit: 5 }).pipe(catchError(() => of(AdminDashboardComponent.emptyPage))),
      products: this.productService.getAll().pipe(catchError(() => of([] as Product[]))),
    }).pipe(tap(() => this.loading.set(false))),
    {
      initialValue: {
        all: AdminDashboardComponent.emptyPage,
        drafts: AdminDashboardComponent.emptyPage,
        published: AdminDashboardComponent.emptyPage,
        recent: AdminDashboardComponent.emptyPage,
        products: [] as Product[],
      },
    }
  );

  protected readonly latestReleases = toSignal(this.releaseService.getLatest(5).pipe(catchError(() => of([]))), { initialValue: [] });

  protected readonly totalEntries = computed(() => this.dashboardData()?.all.total ?? 0);
  protected readonly draftCount = computed(() => this.dashboardData()?.drafts.total ?? 0);
  protected readonly publishedCount = computed(() => this.dashboardData()?.published.total ?? 0);
  protected readonly productCount = computed(() => this.dashboardData()?.products.filter((p) => p.isActive).length ?? 0);
  protected readonly recentEntries = computed(() => this.dashboardData()?.recent.data ?? []);
  protected readonly products = computed(() => this.dashboardData()?.products ?? []);
}
