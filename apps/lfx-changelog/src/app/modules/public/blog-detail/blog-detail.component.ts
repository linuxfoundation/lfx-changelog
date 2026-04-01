// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, DestroyRef, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CardComponent } from '@components/card/card.component';
import { MarkdownRendererComponent } from '@components/markdown-renderer/markdown-renderer.component';
import { ProductPillComponent } from '@components/product-pill/product-pill.component';
import { BlogService } from '@services/blog.service';
import { SeoService } from '@services/seo.service';
import { BlogTypeLabelPipe } from '@shared/pipes/blog-type-label.pipe';
import { DateFormatPipe } from '@shared/pipes/date-format.pipe';
import { stripMarkdown } from '@shared/utils/strip-markdown';
import { catchError, of, tap } from 'rxjs';

import type { BlogPostWithRelations } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-blog-detail',
  imports: [MarkdownRendererComponent, ProductPillComponent, CardComponent, RouterLink, BlogTypeLabelPipe, DateFormatPipe],
  templateUrl: './blog-detail.component.html',
  styleUrl: './blog-detail.component.css',
})
export class BlogDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly blogService = inject(BlogService);
  private readonly seoService = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);

  protected readonly post = this.initPost();

  public constructor() {
    this.destroyRef.onDestroy(() => this.seoService.resetToDefaults());
  }

  private initPost() {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    return toSignal(
      this.blogService.getPublishedBySlug(slug).pipe(
        tap((post) => {
          this.loading.set(false);
          this.setSeo(post);
        }),
        catchError(() => {
          this.loading.set(false);
          return of(undefined);
        })
      )
    );
  }

  private setSeo(post: BlogPostWithRelations): void {
    this.seoService.setPageMeta({
      title: post.title,
      description: post.excerpt || stripMarkdown(post.description).slice(0, 160),
      url: `/blog/${post.slug}`,
      image: post.coverImageUrl || undefined,
      type: 'article',
      publishedAt: post.publishedAt || undefined,
      author: post.author?.name,
    });
  }
}
