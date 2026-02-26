import { Component, computed, signal } from '@angular/core';
import { ChangelogStatus, MOCK_CHANGELOG_ENTRIES, MOCK_PRODUCTS } from '@lfx-changelog/shared';
import { DateFormatPipe } from '@shared/pipes/date-format/date-format.pipe';
import { ChangelogCardComponent } from '@components/changelog-card/changelog-card.component';
import { TimelineItemComponent } from '@components/timeline-item/timeline-item.component';

@Component({
  selector: 'lfx-changelog-feed',
  imports: [ChangelogCardComponent, TimelineItemComponent, DateFormatPipe],
  templateUrl: './changelog-feed.component.html',
  styleUrl: './changelog-feed.component.css',
})
export class ChangelogFeedComponent {
  protected readonly products = MOCK_PRODUCTS;

  protected readonly selectedProduct = signal<string>('');

  protected readonly publishedEntries = computed(() => {
    let entries = MOCK_CHANGELOG_ENTRIES.filter((e) => e.status === ChangelogStatus.PUBLISHED);

    const prodFilter = this.selectedProduct();
    if (prodFilter) {
      entries = entries.filter((e) => e.productId === prodFilter);
    }

    return entries.sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime());
  });

  protected toggleProduct(productId: string): void {
    this.selectedProduct.update((v) => (v === productId ? '' : productId));
  }
}
