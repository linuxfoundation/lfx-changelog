import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MOCK_CHANGELOG_ENTRIES, MOCK_PRODUCTS, MOCK_USERS } from '@lfx-changelog/shared';
import { format } from 'date-fns';
import { CardComponent } from '@components/card/card.component';
import { MarkdownRendererComponent } from '@components/markdown-renderer/markdown-renderer.component';
import { ProductPillComponent } from '@components/product-pill/product-pill.component';

@Component({
  selector: 'lfx-changelog-detail',
  imports: [MarkdownRendererComponent, ProductPillComponent, CardComponent, RouterLink],
  templateUrl: './changelog-detail.component.html',
  styleUrl: './changelog-detail.component.css',
})
export class ChangelogDetailComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly entry = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');
    return MOCK_CHANGELOG_ENTRIES.find((e) => e.id === id);
  });

  protected readonly product = computed(() => {
    const e = this.entry();
    if (!e) return undefined;
    return MOCK_PRODUCTS.find((p) => p.id === e.productId);
  });

  protected readonly author = computed(() => {
    const e = this.entry();
    if (!e) return undefined;
    return MOCK_USERS.find((u) => u.id === e.createdBy);
  });

  protected readonly formattedPublishedAt = computed(() => {
    const e = this.entry();
    if (!e?.publishedAt) return 'Not published';
    return format(new Date(e.publishedAt), 'MMMM d, yyyy');
  });

  protected readonly formattedCreatedAt = computed(() => {
    const e = this.entry();
    if (!e) return '';
    return format(new Date(e.createdAt), 'MMMM d, yyyy');
  });

}
