// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, inject, signal, type Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ChangelogCardComponent } from '@components/changelog-card/changelog-card.component';
import { TimelineItemComponent } from '@components/timeline-item/timeline-item.component';
import { ChangelogService } from '@services/changelog/changelog.service';
import { ProductService } from '@services/product/product.service';
import { SearchService } from '@services/search/search.service';
import { DateFormatPipe } from '@shared/pipes/date-format/date-format.pipe';
import { combineLatest, debounceTime, distinctUntilChanged, map, of, startWith, switchMap, tap } from 'rxjs';

import type { ChangelogEntryWithRelations, PublicProduct, SearchHit, SearchResponse } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-changelog-feed',
  imports: [ChangelogCardComponent, TimelineItemComponent, DateFormatPipe, ReactiveFormsModule],
  templateUrl: './changelog-feed.component.html',
  styleUrl: './changelog-feed.component.css',
})
export class ChangelogFeedComponent {
  private readonly productService = inject(ProductService);
  private readonly changelogService = inject(ChangelogService);
  private readonly searchService = inject(SearchService);

  protected readonly products = toSignal(this.productService.getPublic(), { initialValue: [] as PublicProduct[] });
  protected readonly selectedProduct = signal<string>('');
  protected readonly loading = signal(true);
  protected readonly searchControl = new FormControl('');

  protected readonly publishedEntries: Signal<ChangelogEntryWithRelations[]> = this.initPublishedEntries();
  protected readonly searchResponse: Signal<SearchResponse | null> = this.initSearchResponse();
  protected readonly isSearchActive = computed(() => this.searchResponse() !== null);
  protected readonly searchEntries = computed(() => {
    const response = this.searchResponse();
    if (!response) return [];
    return response.hits.map((hit) => this.mapSearchHitToEntry(hit));
  });

  protected toggleProduct(productId: string): void {
    this.selectedProduct.update((v) => (v === productId ? '' : productId));
  }

  protected clearSearch(): void {
    this.searchControl.setValue('');
  }

  private mapSearchHitToEntry(hit: SearchHit): ChangelogEntryWithRelations {
    return {
      id: hit.id,
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

  private initPublishedEntries(): Signal<ChangelogEntryWithRelations[]> {
    return toSignal(
      toObservable(this.selectedProduct).pipe(
        tap(() => this.loading.set(true)),
        switchMap((productId) => this.changelogService.getPublished(productId ? { productId } : undefined)),
        map((res) => res.data),
        tap(() => this.loading.set(false))
      ),
      { initialValue: [] }
    );
  }

  private initSearchResponse(): Signal<SearchResponse | null> {
    return toSignal(
      combineLatest([this.searchControl.valueChanges.pipe(startWith(''), debounceTime(300), distinctUntilChanged()), toObservable(this.selectedProduct)]).pipe(
        switchMap(([query, productId]) => {
          const q = (query || '').trim();
          if (!q) return of(null);
          return this.searchService.search({ q, productId: productId || undefined });
        })
      ),
      { initialValue: null }
    );
  }
}
