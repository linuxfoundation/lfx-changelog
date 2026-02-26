import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CardComponent } from '@components/card/card.component';
import { MarkdownRendererComponent } from '@components/markdown-renderer/markdown-renderer.component';
import { ProductPillComponent } from '@components/product-pill/product-pill.component';
import { ChangelogService } from '@services/changelog/changelog.service';
import { format } from 'date-fns';
import { tap } from 'rxjs';

@Component({
  selector: 'lfx-changelog-detail',
  imports: [MarkdownRendererComponent, ProductPillComponent, CardComponent, RouterLink],
  templateUrl: './changelog-detail.component.html',
  styleUrl: './changelog-detail.component.css',
})
export class ChangelogDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly changelogService = inject(ChangelogService);

  protected readonly loading = signal(true);

  protected readonly entry = toSignal(
    this.changelogService.getPublishedById(this.route.snapshot.paramMap.get('id') ?? '').pipe(tap(() => this.loading.set(false)))
  );

  protected readonly product = computed(() => this.entry()?.product);

  protected readonly author = computed(() => this.entry()?.author);

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
