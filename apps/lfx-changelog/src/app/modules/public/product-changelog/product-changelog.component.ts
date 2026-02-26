import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ChangelogStatus, MOCK_CHANGELOG_ENTRIES, MOCK_PRODUCTS } from '@lfx-changelog/shared';
import { DateFormatPipe } from '@shared/pipes/date-format/date-format.pipe';
import { ChangelogCardComponent } from '@components/changelog-card/changelog-card.component';
import { TimelineItemComponent } from '@components/timeline-item/timeline-item.component';

@Component({
  selector: 'lfx-product-changelog',
  imports: [ChangelogCardComponent, TimelineItemComponent, RouterLink, DateFormatPipe],
  templateUrl: './product-changelog.component.html',
  styleUrl: './product-changelog.component.css',
})
export class ProductChangelogComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly slug = computed(() => this.route.snapshot.paramMap.get('slug') ?? '');

  protected readonly product = computed(() => MOCK_PRODUCTS.find((p) => p.slug === this.slug()));

  protected readonly entries = computed(() => {
    const prod = this.product();
    if (!prod) return [];

    return MOCK_CHANGELOG_ENTRIES.filter((e) => e.productId === prod.id && e.status === ChangelogStatus.PUBLISHED).sort(
      (a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime()
    );
  });
}
