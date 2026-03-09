// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, DestroyRef, inject, signal, Signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonComponent } from '@components/button/button.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { DropdownMenuComponent } from '@components/dropdown-menu/dropdown-menu.component';
import { PostToSlackDialogComponent } from '@components/post-to-slack-dialog/post-to-slack-dialog.component';
import { SelectComponent } from '@components/select/select.component';
import { StatusBadgeComponent } from '@components/status-badge/status-badge.component';
import { TableColumnDirective } from '@components/table/table-column.directive';
import { TableComponent } from '@components/table/table.component';
import { ChangelogStatus } from '@lfx-changelog/shared';
import { AuthService } from '@services/auth.service';
import { ChangelogService } from '@services/changelog.service';
import { DialogService } from '@services/dialog.service';
import { ProductService } from '@services/product.service';
import { ToastService } from '@services/toast.service';
import { DateFormatPipe } from '@shared/pipes/date-format.pipe';
import { MapGetPipe } from '@shared/pipes/map-get.pipe';
import { ProductNamePipe } from '@shared/pipes/product-name.pipe';
import { BehaviorSubject, catchError, combineLatest, map, of, startWith, switchMap, take, tap } from 'rxjs';

import type { ChangelogEntryWithRelations, PaginatedResponse, Product } from '@lfx-changelog/shared';
import type { DropdownMenuItem, SelectOption } from '@shared/interfaces/form.interface';

@Component({
  selector: 'lfx-changelog-list',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    DropdownMenuComponent,
    StatusBadgeComponent,
    SelectComponent,
    TableComponent,
    TableColumnDirective,
    DateFormatPipe,
    MapGetPipe,
    ProductNamePipe,
  ],
  templateUrl: './changelog-list.component.html',
  styleUrl: './changelog-list.component.css',
})
export class ChangelogListComponent {
  private readonly authService = inject(AuthService);
  private readonly changelogService = inject(ChangelogService);
  private readonly productService = inject(ProductService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly page$ = new BehaviorSubject<number>(1);
  private static readonly defaultPageSize = 20;

  protected readonly productFilterControl = new FormControl('', { nonNullable: true });
  protected readonly statusFilterControl = new FormControl('', { nonNullable: true });

  protected readonly products = toSignal(this.productService.getAll(), { initialValue: [] as Product[] });
  protected readonly loading = signal(true);
  protected readonly reindexing = signal(false);
  protected readonly reindexResult = signal<{ indexed: number; errors: number } | null>(null);
  protected readonly isSuperAdmin = this.authService.isSuperAdmin;

  protected readonly productOptions: Signal<SelectOption[]> = this.initProductOptions();
  protected readonly statusOptions: SelectOption[] = [
    { label: 'All Statuses', value: '' },
    { label: 'Published', value: ChangelogStatus.PUBLISHED },
    { label: 'Draft', value: ChangelogStatus.DRAFT },
  ];

  protected readonly pageState = this.initPageState();
  protected readonly filteredEntries = computed(() => this.pageState().entries);
  protected readonly currentPage = computed(() => this.pageState().page);
  protected readonly totalPages = computed(() => this.pageState().totalPages);
  protected readonly totalItems = computed(() => this.pageState().total);
  protected readonly pageSize = computed(() => this.pageState().pageSize);
  protected readonly entryMenuItems: Signal<Map<string, DropdownMenuItem[]>> = this.initEntryMenuItems();

  public constructor() {
    // Reset to page 1 when filters change
    combineLatest([this.productFilterControl.valueChanges, this.statusFilterControl.valueChanges])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.page$.next(1));
  }

  protected onPageChange(page: number): void {
    this.page$.next(page);
  }

  protected openSlackDialog(entry: ChangelogEntryWithRelations): void {
    this.dialogService.open({
      title: 'Post to Slack',
      size: 'sm',
      component: PostToSlackDialogComponent,
      inputs: {
        changelogId: entry.id,
        changelogTitle: entry.title,
        onPosted: (channelName: string) => this.toastService.success(`Posted to #${channelName}`),
      },
    });
  }

  protected reindex(): void {
    this.reindexing.set(true);
    this.reindexResult.set(null);
    this.changelogService
      .reindexSearch()
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          this.reindexResult.set(result);
          this.reindexing.set(false);
        },
        error: () => this.reindexing.set(false),
      });
  }

  private confirmUnpublish(entry: ChangelogEntryWithRelations): void {
    this.dialogService.open({
      title: 'Unpublish Entry',
      size: 'sm',
      component: ConfirmDialogComponent,
      inputs: {
        message: 'This will revert the entry to draft and remove it from public view.',
        confirmLabel: 'Unpublish',
      },
      onClose: (result) => {
        if (result === 'confirmed') this.unpublishEntry(entry);
      },
    });
  }

  private confirmDelete(entry: ChangelogEntryWithRelations): void {
    this.dialogService.open({
      title: 'Delete Entry',
      size: 'sm',
      component: ConfirmDialogComponent,
      inputs: {
        message: 'This will permanently delete this entry. This action cannot be undone.',
        confirmLabel: 'Delete',
        danger: true,
      },
      onClose: (result) => {
        if (result === 'confirmed') this.deleteEntry(entry);
      },
    });
  }

  private unpublishEntry(entry: ChangelogEntryWithRelations): void {
    this.changelogService.unpublish(entry.id).subscribe({
      next: () => {
        this.toastService.success('Entry reverted to draft');
        this.refreshList();
      },
      error: () => this.toastService.error('Failed to unpublish entry'),
    });
  }

  private deleteEntry(entry: ChangelogEntryWithRelations): void {
    this.changelogService.remove(entry.id).subscribe({
      next: () => {
        this.toastService.success('Entry deleted');
        this.refreshList();
      },
      error: () => this.toastService.error('Failed to delete entry'),
    });
  }

  private refreshList(): void {
    this.page$.next(this.page$.value);
  }

  private initEntryMenuItems(): Signal<Map<string, DropdownMenuItem[]>> {
    return computed(() => {
      const entries = this.filteredEntries();
      const menuMap = new Map<string, DropdownMenuItem[]>();

      for (const entry of entries) {
        const canEdit = this.authService.canEditProduct(entry.productId);
        const items: DropdownMenuItem[] = [];

        if (entry.status === ChangelogStatus.PUBLISHED) {
          items.push({ label: 'View', routerLink: ['/entry', entry.slug ?? ''] });
        }

        if (entry.status === ChangelogStatus.PUBLISHED && canEdit) {
          items.push({ label: 'Post to Slack', action: () => this.openSlackDialog(entry) });
          items.push({ label: 'Unpublish', action: () => this.confirmUnpublish(entry) });
        }

        if (canEdit) {
          items.push({ label: 'Delete', action: () => this.confirmDelete(entry), danger: true });
        }

        menuMap.set(entry.id, items);
      }

      return menuMap;
    });
  }

  private initProductOptions(): Signal<SelectOption[]> {
    return computed(() => [
      { label: 'All Products', value: '' },
      ...this.products()
        .filter((p) => p.isActive)
        .map((p) => ({ label: p.name, value: p.id })),
    ]);
  }

  private initPageState() {
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
              map((res: PaginatedResponse<ChangelogEntryWithRelations>) => ({
                entries: res.data,
                total: res.total,
                page: res.page,
                pageSize: res.pageSize,
                totalPages: res.totalPages,
              })),
              catchError(() => of({ entries: [], total: 0, page: 1, pageSize: ChangelogListComponent.defaultPageSize, totalPages: 0 }))
            )
        ),
        tap(() => this.loading.set(false))
      ),
      { initialValue: { entries: [], total: 0, page: 1, pageSize: ChangelogListComponent.defaultPageSize, totalPages: 0 } }
    );
  }
}
