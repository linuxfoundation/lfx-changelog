// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ChangelogCardComponent } from '@components/changelog-card/changelog-card.component';
import { TimelineItemComponent } from '@components/timeline-item/timeline-item.component';
import { ChangelogService } from '@services/changelog.service';
import { ProductService } from '@services/product.service';
import { SeoService } from '@services/seo.service';
import { DateFormatPipe } from '@shared/pipes/date-format.pipe';
import { map, of, switchMap, tap } from 'rxjs';

import type { Signal } from '@angular/core';
import type { ChangelogEntryWithRelations, PublicProduct } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-product-changelog',
  imports: [ChangelogCardComponent, TimelineItemComponent, RouterLink, DateFormatPipe],
  templateUrl: './product-changelog.component.html',
  styleUrl: './product-changelog.component.css',
})
export class ProductChangelogComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly productService = inject(ProductService);
  private readonly changelogService = inject(ChangelogService);
  private readonly seoService = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly products = toSignal(this.productService.getPublic(), { initialValue: [] as PublicProduct[] });
  protected readonly loading = signal(true);

  protected readonly slug = computed(() => this.route.snapshot.paramMap.get('slug') ?? '');

  protected readonly product = computed(() => this.products().find((p) => p.slug === this.slug()));

  protected readonly entries: Signal<ChangelogEntryWithRelations[]> = this.initEntries();

  public constructor() {
    this.destroyRef.onDestroy(() => this.seoService.resetToDefaults());
  }

  private initEntries(): Signal<ChangelogEntryWithRelations[]> {
    return toSignal(
      toObservable(this.products).pipe(
        map((products) => products.find((p) => p.slug === this.slug())),
        tap((product) => {
          if (product) {
            this.seoService.setPageMeta({
              title: `${product.name} Changelog`,
              description: product.description || `Latest changes and updates for ${product.name}.`,
              url: `/products/${product.slug}`,
            });
          }
        }),
        switchMap((product) => {
          if (!product) {
            return of([] as ChangelogEntryWithRelations[]);
          }
          return this.changelogService.getPublished({ productId: product.id }).pipe(map((res) => res.data));
        }),
        tap(() => this.loading.set(false))
      ),
      { initialValue: [] }
    );
  }
}
