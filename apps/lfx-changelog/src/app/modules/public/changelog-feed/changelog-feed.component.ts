// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { isPlatformBrowser } from '@angular/common';
import { Component, computed, inject, PLATFORM_ID, signal, type Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ChangelogCardComponent } from '@components/changelog-card/changelog-card.component';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { TimelineItemComponent } from '@components/timeline-item/timeline-item.component';
import { ChangelogService } from '@services/changelog.service';
import { ProductService } from '@services/product.service';
import { SearchService } from '@services/search.service';
import { DateFormatPipe } from '@shared/pipes/date-format.pipe';
import { catchError, combineLatest, debounceTime, distinctUntilChanged, of, startWith, switchMap, tap } from 'rxjs';

import type { ChangelogEntryWithRelations, ChangelogSearchHit, PaginatedResponse, PublicProduct, SearchResponse } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-changelog-feed',
  imports: [ChangelogCardComponent, PaginationComponent, TimelineItemComponent, DateFormatPipe, ReactiveFormsModule],
  templateUrl: './changelog-feed.component.html',
  styleUrl: './changelog-feed.component.css',
})
export class ChangelogFeedComponent {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly productService = inject(ProductService);
  private readonly changelogService = inject(ChangelogService);
  private readonly searchService = inject(SearchService);

  protected readonly products = toSignal(this.productService.getPublic(), { initialValue: [] as PublicProduct[] });
  protected readonly selectedProduct = signal<string>('');
  protected readonly loading = signal(true);
  protected readonly searchControl = new FormControl('');
  protected readonly searchValue = toSignal(this.searchControl.valueChanges.pipe(startWith('')), { initialValue: '' });
  protected readonly currentPage = signal(1);

  private readonly fetchParams = computed(() => ({ productId: this.selectedProduct(), page: this.currentPage() }));
  protected readonly paginatedResult: Signal<PaginatedResponse<ChangelogEntryWithRelations>> = this.initPaginatedResult();
  protected readonly publishedEntries = computed(() => this.paginatedResult().data);
  protected readonly totalPages = computed(() => this.paginatedResult().totalPages);
  protected readonly totalItems = computed(() => this.paginatedResult().total);
  protected readonly pageSize = computed(() => this.paginatedResult().pageSize);

  protected readonly searchResponse: Signal<SearchResponse<ChangelogSearchHit> | null> = this.initSearchResponse();
  protected readonly isSearchActive = computed(() => this.searchResponse() !== null);
  protected readonly searchEntries = computed(() => {
    const response = this.searchResponse();
    if (!response) return [];
    return response.hits.map((hit) => this.mapSearchHitToEntry(hit));
  });

  protected toggleProduct(productId: string): void {
    this.selectedProduct.update((v) => (v === productId ? '' : productId));
    this.currentPage.set(1);
  }

  protected onPageChange(page: number): void {
    this.currentPage.set(page);
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  protected clearSearch(): void {
    this.searchControl.setValue('');
  }

  private mapSearchHitToEntry(hit: ChangelogSearchHit): ChangelogEntryWithRelations {
    return {
      id: hit.id,
      slug: hit.slug,
      title: hit.title,
      description: hit.description,
      version: hit.version,
      status: hit.status as ChangelogEntryWithRelations['status'],
      publishedAt: hit.publishedAt,
      createdAt: hit.createdAt,
      updatedAt: hit.createdAt,
      productId: hit.productId,
      createdBy: '',
      product: {
        id: hit.productId,
        name: hit.productName,
        slug: hit.productSlug,
        description: null,
        iconUrl: null,
        faIcon: hit.productFaIcon ?? null,
        isActive: true,
        githubInstallationId: null,
        createdAt: '',
        updatedAt: '',
      },
    };
  }

  private initPaginatedResult(): Signal<PaginatedResponse<ChangelogEntryWithRelations>> {
    const emptyResult: PaginatedResponse<ChangelogEntryWithRelations> = { success: true, data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
    return toSignal(
      toObservable(this.fetchParams).pipe(
        tap(() => this.loading.set(true)),
        switchMap(({ productId, page }) =>
          this.changelogService.getPublished({ ...(productId ? { productId } : {}), page }).pipe(catchError(() => of(emptyResult)))
        ),
        tap(() => this.loading.set(false))
      ),
      { initialValue: emptyResult }
    );
  }

  private initSearchResponse(): Signal<SearchResponse<ChangelogSearchHit> | null> {
    return toSignal(
      combineLatest([this.searchControl.valueChanges.pipe(startWith(''), debounceTime(300), distinctUntilChanged()), toObservable(this.selectedProduct)]).pipe(
        switchMap(([query, productId]) => {
          const q = (query || '').trim();
          if (!q) return of(null);
          return this.searchService.search<ChangelogSearchHit>({ target: 'changelogs', q, productId: productId || undefined }).pipe(catchError(() => of(null)));
        })
      ),
      { initialValue: null }
    );
  }
}
