// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, DestroyRef, inject, signal, type Signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonComponent } from '@components/button/button.component';
import { SelectComponent } from '@components/select/select.component';
import { StatusBadgeComponent } from '@components/status-badge/status-badge.component';
import { TableColumnDirective } from '@components/table/table-column.directive';
import { TableComponent } from '@components/table/table.component';
import { ChangelogStatus } from '@lfx-changelog/shared';
import { ChangelogService } from '@services/changelog/changelog.service';
import { ProductService } from '@services/product/product.service';
import { DateFormatPipe } from '@shared/pipes/date-format/date-format.pipe';
import { ProductNamePipe } from '@shared/pipes/product-name/product-name.pipe';
import { BehaviorSubject, combineLatest, map, startWith, switchMap, tap } from 'rxjs';

import type { ChangelogEntryWithRelations, PaginatedResponse, Product } from '@lfx-changelog/shared';
import type { SelectOption } from '@shared/interfaces/form.interface';

interface PageState {
  entries: ChangelogEntryWithRelations[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Component({
  selector: 'lfx-changelog-list',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    StatusBadgeComponent,
    SelectComponent,
    TableComponent,
    TableColumnDirective,
    DateFormatPipe,
    ProductNamePipe,
  ],
  templateUrl: './changelog-list.component.html',
  styleUrl: './changelog-list.component.css',
})
export class ChangelogListComponent {
  private readonly changelogService = inject(ChangelogService);
  private readonly productService = inject(ProductService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly page$ = new BehaviorSubject<number>(1);
  private static readonly defaultPageSize = 20;

  protected readonly productFilterControl = new FormControl('', { nonNullable: true });
  protected readonly statusFilterControl = new FormControl('', { nonNullable: true });

  protected readonly products = toSignal(this.productService.getAll(), { initialValue: [] as Product[] });
  protected readonly loading = signal(true);

  protected readonly productOptions: Signal<SelectOption[]> = this.initProductOptions();
  protected readonly statusOptions: SelectOption[] = [
    { label: 'All Statuses', value: '' },
    { label: 'Published', value: ChangelogStatus.PUBLISHED },
    { label: 'Draft', value: ChangelogStatus.DRAFT },
  ];

  protected readonly pageState: Signal<PageState> = this.initPageState();
  protected readonly filteredEntries = computed(() => this.pageState().entries);
  protected readonly currentPage = computed(() => this.pageState().page);
  protected readonly totalPages = computed(() => this.pageState().totalPages);
  protected readonly totalItems = computed(() => this.pageState().total);
  protected readonly pageSize = computed(() => this.pageState().pageSize);

  public constructor() {
    // Reset to page 1 when filters change
    combineLatest([this.productFilterControl.valueChanges, this.statusFilterControl.valueChanges])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.page$.next(1));
  }

  protected onPageChange(page: number): void {
    this.page$.next(page);
  }

  private initProductOptions(): Signal<SelectOption[]> {
    return computed(() => [{ label: 'All Products', value: '' }, ...this.products().map((p) => ({ label: p.name, value: p.id }))]);
  }

  private initPageState(): Signal<PageState> {
    return toSignal(
      combineLatest([
        this.productFilterControl.valueChanges.pipe(startWith(this.productFilterControl.value)),
        this.statusFilterControl.valueChanges.pipe(startWith(this.statusFilterControl.value)),
        this.page$,
      ]).pipe(
        tap(() => this.loading.set(true)),
        switchMap(([productId, status, page]) =>
          this.changelogService
            .getAll({
              ...(productId ? { productId } : {}),
              ...(status ? { status } : {}),
              page,
              limit: ChangelogListComponent.defaultPageSize,
            })
            .pipe(
              map(
                (res: PaginatedResponse<ChangelogEntryWithRelations>): PageState => ({
                  entries: res.data,
                  total: res.total,
                  page: res.page,
                  pageSize: res.pageSize,
                  totalPages: res.totalPages,
                })
              )
            )
        ),
        tap(() => this.loading.set(false))
      ),
      { initialValue: { entries: [], total: 0, page: 1, pageSize: ChangelogListComponent.defaultPageSize, totalPages: 0 } }
    );
  }
}
