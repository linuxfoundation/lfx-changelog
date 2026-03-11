// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CardComponent } from '@components/card/card.component';
import { MarkdownRendererComponent } from '@components/markdown-renderer/markdown-renderer.component';
import { ProductPillComponent } from '@components/product-pill/product-pill.component';
import { BlogService } from '@services/blog.service';
import { DateFormatPipe } from '@shared/pipes/date-format.pipe';
import { format } from 'date-fns';
import { catchError, of, tap } from 'rxjs';

@Component({
  selector: 'lfx-blog-detail',
  imports: [MarkdownRendererComponent, ProductPillComponent, CardComponent, RouterLink, DateFormatPipe],
  templateUrl: './blog-detail.component.html',
  styleUrl: './blog-detail.component.css',
})
export class BlogDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly blogService = inject(BlogService);

  protected readonly loading = signal(true);

  protected readonly post = toSignal(
    this.blogService.getPublishedBySlug(this.route.snapshot.paramMap.get('slug') ?? '').pipe(
      tap(() => this.loading.set(false)),
      catchError(() => {
        this.loading.set(false);
        return of(undefined);
      })
    )
  );

  protected readonly formattedPublishedAt = computed(() => {
    const p = this.post();
    if (!p?.publishedAt) return 'Not published';
    return format(new Date(p.publishedAt), 'MMMM d, yyyy');
  });

  protected readonly typeLabel = computed(() => {
    const p = this.post();
    if (!p) return '';
    return p.type === 'monthly_roundup' ? 'Monthly Roundup' : 'Product Newsletter';
  });
}
