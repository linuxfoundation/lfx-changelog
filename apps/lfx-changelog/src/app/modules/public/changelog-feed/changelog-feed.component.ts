import { Component, inject, signal, type Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ChangelogCardComponent } from '@components/changelog-card/changelog-card.component';
import { TimelineItemComponent } from '@components/timeline-item/timeline-item.component';
import type { ChangelogEntryWithRelations, Product } from '@lfx-changelog/shared';
import { ChangelogService } from '@services/changelog/changelog.service';
import { ProductService } from '@services/product/product.service';
import { DateFormatPipe } from '@shared/pipes/date-format/date-format.pipe';
import { map, switchMap, tap } from 'rxjs';

@Component({
  selector: 'lfx-changelog-feed',
  imports: [ChangelogCardComponent, TimelineItemComponent, DateFormatPipe],
  templateUrl: './changelog-feed.component.html',
  styleUrl: './changelog-feed.component.css',
})
export class ChangelogFeedComponent {
  private readonly productService = inject(ProductService);
  private readonly changelogService = inject(ChangelogService);

  protected readonly products = toSignal(this.productService.getAll(), { initialValue: [] as Product[] });
  protected readonly selectedProduct = signal<string>('');
  protected readonly loading = signal(true);

  protected readonly publishedEntries: Signal<ChangelogEntryWithRelations[]> = this.initPublishedEntries();

  protected toggleProduct(productId: string): void {
    this.selectedProduct.update((v) => (v === productId ? '' : productId));
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
}
