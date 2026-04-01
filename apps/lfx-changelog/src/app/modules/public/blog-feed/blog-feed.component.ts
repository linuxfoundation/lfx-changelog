// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { isPlatformBrowser } from '@angular/common';
import { Component, computed, inject, PLATFORM_ID, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CardComponent } from '@components/card/card.component';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { ProductPillComponent } from '@components/product-pill/product-pill.component';
import { BlogService } from '@services/blog.service';
import { SeoService } from '@services/seo.service';
import { BlogTypeLabelPipe } from '@shared/pipes/blog-type-label.pipe';
import { DateFormatPipe } from '@shared/pipes/date-format.pipe';
import { catchError, of, switchMap, tap } from 'rxjs';

import type { Signal } from '@angular/core';
import type { BlogPostWithRelations, PaginatedResponse } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-blog-feed',
  imports: [RouterLink, CardComponent, PaginationComponent, ProductPillComponent, BlogTypeLabelPipe, DateFormatPipe],
  templateUrl: './blog-feed.component.html',
  styleUrl: './blog-feed.component.css',
})
export class BlogFeedComponent {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly blogService = inject(BlogService);
  private readonly seoService = inject(SeoService);

  protected readonly loading = signal(true);
  protected readonly currentPage = signal(1);

  protected readonly paginatedResult: Signal<PaginatedResponse<BlogPostWithRelations>> = this.initPaginatedResult();
  protected readonly posts = computed(() => this.paginatedResult().data);
  protected readonly totalPages = computed(() => this.paginatedResult().totalPages);
  protected readonly totalItems = computed(() => this.paginatedResult().total);
  protected readonly pageSize = computed(() => this.paginatedResult().pageSize);

  public constructor() {
    this.seoService.setPageMeta({
      title: 'Blog',
      description: 'Read the latest updates, release summaries, and announcements from the LFX team.',
      url: '/blog',
    });
  }

  protected onPageChange(page: number): void {
    this.currentPage.set(page);
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  private initPaginatedResult(): Signal<PaginatedResponse<BlogPostWithRelations>> {
    const emptyResult: PaginatedResponse<BlogPostWithRelations> = { success: true, data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
    return toSignal(
      toObservable(this.currentPage).pipe(
        tap(() => this.loading.set(true)),
        switchMap((page) => this.blogService.getPublished({ page }).pipe(catchError(() => of(emptyResult)))),
        tap(() => this.loading.set(false))
      ),
      { initialValue: emptyResult }
    );
  }
}
