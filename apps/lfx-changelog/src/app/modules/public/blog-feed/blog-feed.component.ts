// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CardComponent } from '@components/card/card.component';
import { ProductPillComponent } from '@components/product-pill/product-pill.component';
import { BlogPostService } from '@services/blog-post.service';
import { DateFormatPipe } from '@shared/pipes/date-format.pipe';
import { map, tap } from 'rxjs';

import type { Signal } from '@angular/core';
import type { BlogPostWithRelations } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-blog-feed',
  imports: [RouterLink, CardComponent, ProductPillComponent, DateFormatPipe],
  templateUrl: './blog-feed.component.html',
  styleUrl: './blog-feed.component.css',
})
export class BlogFeedComponent {
  private readonly blogPostService = inject(BlogPostService);

  protected readonly loading = signal(true);

  protected readonly posts: Signal<BlogPostWithRelations[]> = this.initPosts();

  private initPosts(): Signal<BlogPostWithRelations[]> {
    return toSignal(
      this.blogPostService.getPublished().pipe(
        map((res) => res.data),
        tap(() => this.loading.set(false))
      ),
      { initialValue: [] }
    );
  }
}
