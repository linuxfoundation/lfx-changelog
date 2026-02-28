// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'lfx-pagination',
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.css',
})
export class PaginationComponent {
  public readonly currentPage = input.required<number>();
  public readonly totalPages = input.required<number>();
  public readonly totalItems = input<number>(0);
  public readonly pageSize = input<number>(20);

  public readonly pageChange = output<number>();

  protected readonly hasPrevious = computed(() => this.currentPage() > 1);
  protected readonly hasNext = computed(() => this.currentPage() < this.totalPages());

  protected readonly rangeStart = computed(() => {
    const total = this.totalItems();
    if (total === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  protected readonly rangeEnd = computed(() => {
    const total = this.totalItems();
    const end = this.currentPage() * this.pageSize();
    return Math.min(end, total);
  });

  /** Produces page numbers with null representing an ellipsis gap. */
  protected readonly visiblePages: ReturnType<typeof computed<(number | null)[]>> = this.initVisiblePages();

  protected goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages() && page !== this.currentPage()) {
      this.pageChange.emit(page);
    }
  }

  private initVisiblePages(): ReturnType<typeof computed<(number | null)[]>> {
    return computed(() => {
      const total = this.totalPages();
      const current = this.currentPage();

      if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1);
      }

      const pages: (number | null)[] = [1];

      if (current > 3) {
        pages.push(null);
      }

      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (current < total - 2) {
        pages.push(null);
      }

      pages.push(total);

      return pages;
    });
  }
}
