// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, inject, signal, type Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ChangelogCardComponent } from '@components/changelog-card/changelog-card.component';
import { TimelineItemComponent } from '@components/timeline-item/timeline-item.component';
import type { ChangelogEntryWithRelations, PublicProduct } from '@lfx-changelog/shared';
import { ChangelogService } from '@services/changelog/changelog.service';
import { ProductService } from '@services/product/product.service';
import { DateFormatPipe } from '@shared/pipes/date-format/date-format.pipe';
import { map, of, switchMap, tap } from 'rxjs';

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

  protected readonly products = toSignal(this.productService.getPublic(), { initialValue: [] as PublicProduct[] });
  protected readonly loading = signal(true);

  protected readonly slug = computed(() => this.route.snapshot.paramMap.get('slug') ?? '');

  protected readonly product = computed(() => this.products().find((p) => p.slug === this.slug()));

  protected readonly entries: Signal<ChangelogEntryWithRelations[]> = this.initEntries();

  private initEntries(): Signal<ChangelogEntryWithRelations[]> {
    return toSignal(
      toObservable(this.products).pipe(
        map((products) => products.find((p) => p.slug === this.slug())),
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
