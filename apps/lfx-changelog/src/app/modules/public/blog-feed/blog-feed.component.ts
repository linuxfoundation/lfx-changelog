// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CardComponent } from '@components/card/card.component';
import { ProductPillComponent } from '@components/product-pill/product-pill.component';
import { BlogService } from '@services/blog.service';
import { BlogTypeLabelPipe } from '@shared/pipes/blog-type-label.pipe';
import { DateFormatPipe } from '@shared/pipes/date-format.pipe';
import { catchError, finalize, map, of } from 'rxjs';

import type { Signal } from '@angular/core';
import type { BlogPostWithRelations } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-blog-feed',
  imports: [RouterLink, CardComponent, ProductPillComponent, BlogTypeLabelPipe, DateFormatPipe],
  templateUrl: './blog-feed.component.html',
  styleUrl: './blog-feed.component.css',
})
export class BlogFeedComponent {
  private readonly blogService = inject(BlogService);

  protected readonly loading = signal(true);

  protected readonly posts: Signal<BlogPostWithRelations[]> = this.initPosts();

  private initPosts(): Signal<BlogPostWithRelations[]> {
    return toSignal(
      this.blogService.getPublished().pipe(
        map((res) => res.data),
        catchError(() => of([])),
        finalize(() => this.loading.set(false))
      ),
      { initialValue: [] }
    );
  }
}
