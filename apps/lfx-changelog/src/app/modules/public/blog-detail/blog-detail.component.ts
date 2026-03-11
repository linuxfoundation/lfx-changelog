// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CardComponent } from '@components/card/card.component';
import { MarkdownRendererComponent } from '@components/markdown-renderer/markdown-renderer.component';
import { ProductPillComponent } from '@components/product-pill/product-pill.component';
import { BlogService } from '@services/blog.service';
import { BlogTypeLabelPipe } from '@shared/pipes/blog-type-label.pipe';
import { DateFormatPipe } from '@shared/pipes/date-format.pipe';
import { catchError, of, tap } from 'rxjs';

@Component({
  selector: 'lfx-blog-detail',
  imports: [MarkdownRendererComponent, ProductPillComponent, CardComponent, RouterLink, BlogTypeLabelPipe, DateFormatPipe],
  templateUrl: './blog-detail.component.html',
  styleUrl: './blog-detail.component.css',
})
export class BlogDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly blogService = inject(BlogService);

  protected readonly loading = signal(true);

  protected readonly post = this.initPost();

  private initPost() {
    return toSignal(
      this.blogService.getPublishedBySlug(this.route.snapshot.paramMap.get('slug') ?? '').pipe(
        tap(() => this.loading.set(false)),
        catchError(() => {
          this.loading.set(false);
          return of(undefined);
        })
      )
    );
  }
}
