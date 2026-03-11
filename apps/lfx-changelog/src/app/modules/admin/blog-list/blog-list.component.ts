// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, DestroyRef, inject, signal, Signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonComponent } from '@components/button/button.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { DropdownMenuComponent } from '@components/dropdown-menu/dropdown-menu.component';
import { SelectComponent } from '@components/select/select.component';
import { StatusBadgeComponent } from '@components/status-badge/status-badge.component';
import { TableColumnDirective } from '@components/table/table-column.directive';
import { TableComponent } from '@components/table/table.component';
import { BlogStatus, BlogType } from '@lfx-changelog/shared';
import { AuthService } from '@services/auth.service';
import { BlogService } from '@services/blog.service';
import { DialogService } from '@services/dialog.service';
import { ToastService } from '@services/toast.service';
import { BlogTypeLabelPipe } from '@shared/pipes/blog-type-label.pipe';
import { DateFormatPipe } from '@shared/pipes/date-format.pipe';
import { MapGetPipe } from '@shared/pipes/map-get.pipe';
import { BehaviorSubject, catchError, combineLatest, map, of, startWith, switchMap, tap } from 'rxjs';

import type { BlogPostWithRelations, PaginatedResponse } from '@lfx-changelog/shared';
import type { DropdownMenuItem, SelectOption } from '@shared/interfaces/form.interface';

@Component({
  selector: 'lfx-blog-list',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    DropdownMenuComponent,
    SelectComponent,
    StatusBadgeComponent,
    TableComponent,
    TableColumnDirective,
    BlogTypeLabelPipe,
    DateFormatPipe,
    MapGetPipe,
  ],
  templateUrl: './blog-list.component.html',
  styleUrl: './blog-list.component.css',
})
export class BlogListComponent {
  private readonly authService = inject(AuthService);
  private readonly blogService = inject(BlogService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly page$ = new BehaviorSubject<number>(1);
  private static readonly defaultPageSize = 20;

  protected readonly typeFilterControl = new FormControl('', { nonNullable: true });
  protected readonly statusFilterControl = new FormControl('', { nonNullable: true });

  protected readonly loading = signal(true);
  protected readonly isSuperAdmin = this.authService.isSuperAdmin;

  protected readonly typeOptions: SelectOption[] = [
    { label: 'All Types', value: '' },
    { label: 'Monthly Roundup', value: BlogType.MONTHLY_ROUNDUP },
    { label: 'Product Newsletter', value: BlogType.PRODUCT_NEWSLETTER },
  ];

  protected readonly statusOptions: SelectOption[] = [
    { label: 'All Statuses', value: '' },
    { label: 'Published', value: BlogStatus.PUBLISHED },
    { label: 'Draft', value: BlogStatus.DRAFT },
  ];

  protected readonly pageState = this.initPageState();
  protected readonly filteredEntries = computed(() => this.pageState().entries);
  protected readonly currentPage = computed(() => this.pageState().page);
  protected readonly totalPages = computed(() => this.pageState().totalPages);
  protected readonly totalItems = computed(() => this.pageState().total);
  protected readonly pageSize = computed(() => this.pageState().pageSize);
  protected readonly entryMenuItems: Signal<Map<string, DropdownMenuItem[]>> = this.initEntryMenuItems();

  public constructor() {
    combineLatest([this.typeFilterControl.valueChanges, this.statusFilterControl.valueChanges])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.page$.next(1));
  }

  protected onPageChange(page: number): void {
    this.page$.next(page);
  }

  private confirmUnpublish(entry: BlogPostWithRelations): void {
    this.dialogService.open({
      title: 'Unpublish Blog Post',
      size: 'sm',
      component: ConfirmDialogComponent,
      inputs: {
        message: 'This will revert the blog post to draft and remove it from public view.',
        confirmLabel: 'Unpublish',
      },
      onClose: (result) => {
        if (result === 'confirmed') this.unpublishEntry(entry);
      },
    });
  }

  private confirmDelete(entry: BlogPostWithRelations): void {
    this.dialogService.open({
      title: 'Delete Blog Post',
      size: 'sm',
      component: ConfirmDialogComponent,
      inputs: {
        message: 'This will permanently delete this blog post. This action cannot be undone.',
        confirmLabel: 'Delete',
        danger: true,
      },
      onClose: (result) => {
        if (result === 'confirmed') this.deleteEntry(entry);
      },
    });
  }

  private unpublishEntry(entry: BlogPostWithRelations): void {
    this.blogService.unpublish(entry.id).subscribe({
      next: () => {
        this.toastService.success('Blog post reverted to draft');
        this.refreshList();
      },
      error: () => this.toastService.error('Failed to unpublish blog post'),
    });
  }

  private deleteEntry(entry: BlogPostWithRelations): void {
    this.blogService.remove(entry.id).subscribe({
      next: () => {
        this.toastService.success('Blog post deleted');
        this.refreshList();
      },
      error: () => this.toastService.error('Failed to delete blog post'),
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
        const items: DropdownMenuItem[] = [];

        if (entry.status === BlogStatus.PUBLISHED) {
          items.push({ label: 'View', routerLink: ['/blog', entry.slug] });
          items.push({ label: 'Unpublish', action: () => this.confirmUnpublish(entry) });
        }

        if (this.isSuperAdmin()) {
          items.push({ label: 'Delete', action: () => this.confirmDelete(entry), danger: true });
        }

        menuMap.set(entry.id, items);
      }

      return menuMap;
    });
  }

  private initPageState() {
    return toSignal(
      combineLatest([
        this.typeFilterControl.valueChanges.pipe(startWith(this.typeFilterControl.value)),
        this.statusFilterControl.valueChanges.pipe(startWith(this.statusFilterControl.value)),
        this.page$,
      ]).pipe(
        tap(() => this.loading.set(true)),
        switchMap(([type, status, page]) =>
          this.blogService
            .getAll({
              ...(type ? { type } : {}),
              ...(status ? { status } : {}),
              page,
              limit: BlogListComponent.defaultPageSize,
            })
            .pipe(
              map((res: PaginatedResponse<BlogPostWithRelations>) => ({
                entries: res.data,
                total: res.total,
                page: res.page,
                pageSize: res.pageSize,
                totalPages: res.totalPages,
              })),
              catchError(() => of({ entries: [], total: 0, page: 1, pageSize: BlogListComponent.defaultPageSize, totalPages: 0 }))
            )
        ),
        tap(() => this.loading.set(false))
      ),
      { initialValue: { entries: [], total: 0, page: 1, pageSize: BlogListComponent.defaultPageSize, totalPages: 0 } }
    );
  }
}
