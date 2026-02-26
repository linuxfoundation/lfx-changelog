import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { StatusBadgeComponent } from '@components/status-badge/status-badge.component';
import { ChangelogStatus } from '@lfx-changelog/shared';
import { ChangelogService } from '@services/changelog/changelog.service';
import { ProductService } from '@services/product/product.service';
import { DateFormatPipe } from '@shared/pipes/date-format/date-format.pipe';
import { ProductNamePipe } from '@shared/pipes/product-name/product-name.pipe';
import { forkJoin, tap } from 'rxjs';

@Component({
  selector: 'lfx-admin-dashboard',
  imports: [StatusBadgeComponent, RouterLink, DateFormatPipe, ProductNamePipe],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css',
})
export class AdminDashboardComponent {
  private readonly changelogService = inject(ChangelogService);
  private readonly productService = inject(ProductService);

  protected readonly loading = signal(true);

  protected readonly dashboardData = toSignal(
    forkJoin({
      all: this.changelogService.getAll({ limit: 1 }),
      drafts: this.changelogService.getAll({ status: ChangelogStatus.DRAFT, limit: 1 }),
      published: this.changelogService.getAll({ status: ChangelogStatus.PUBLISHED, limit: 1 }),
      recent: this.changelogService.getAll({ limit: 5 }),
      products: this.productService.getAll(),
    }).pipe(tap(() => this.loading.set(false)))
  );

  protected readonly totalEntries = computed(() => this.dashboardData()?.all.total ?? 0);
  protected readonly draftCount = computed(() => this.dashboardData()?.drafts.total ?? 0);
  protected readonly publishedCount = computed(() => this.dashboardData()?.published.total ?? 0);
  protected readonly productCount = computed(() => this.dashboardData()?.products.length ?? 0);
  protected readonly recentEntries = computed(() => this.dashboardData()?.recent.data ?? []);
  protected readonly products = computed(() => this.dashboardData()?.products ?? []);
}
