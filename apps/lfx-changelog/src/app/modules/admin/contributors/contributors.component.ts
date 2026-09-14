// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, DestroyRef, inject, Signal, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { BadgeComponent } from '@components/badge/badge.component';
import { ButtonComponent } from '@components/button/button.component';
import { CardComponent } from '@components/card/card.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { DropdownMenuComponent } from '@components/dropdown-menu/dropdown-menu.component';
import { InputComponent } from '@components/input/input.component';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { SelectComponent } from '@components/select/select.component';
import { TableColumnDirective } from '@components/table/table-column.directive';
import { TableComponent } from '@components/table/table.component';
import { LinkSlackDialogComponent } from '@modules/admin/components/link-slack-dialog/link-slack-dialog.component';
import { ContributorService } from '@services/contributor.service';
import { DialogService } from '@services/dialog.service';
import { ProductService } from '@services/product.service';
import { ToastService } from '@services/toast.service';
import { MapGetPipe } from '@shared/pipes/map-get.pipe';
import { BehaviorSubject, catchError, combineLatest, debounceTime, distinctUntilChanged, map, merge, of, startWith, switchMap, tap } from 'rxjs';

import type { ContributorWithRelations, PaginatedResponse, Product } from '@lfx-changelog/shared';
import type { ContributorPageState } from '@shared/interfaces/contributor.interface';
import type { DropdownMenuItem, SelectOption } from '@shared/interfaces/form.interface';

const EMPTY_PAGE_STATE: ContributorPageState = { contributors: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };

@Component({
  selector: 'lfx-contributors',
  imports: [
    ReactiveFormsModule,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    DropdownMenuComponent,
    InputComponent,
    PaginationComponent,
    SelectComponent,
    TableComponent,
    TableColumnDirective,
    MapGetPipe,
  ],
  templateUrl: './contributors.component.html',
  styleUrl: './contributors.component.css',
})
export class ContributorsComponent {
  private readonly contributorService = inject(ContributorService);
  private readonly productService = inject(ProductService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly refresh$ = new BehaviorSubject<void>(undefined);
  private readonly page$ = new BehaviorSubject<number>(1);
  private static readonly defaultPageSize = 20;
  private static readonly searchDebounceMs = 250;

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly productFilterControl = new FormControl('', { nonNullable: true });
  protected readonly slackFilterControl = new FormControl('', { nonNullable: true });

  protected readonly loading = signal(true);
  protected readonly syncing = signal(false);

  protected readonly slackFilterOptions: SelectOption[] = [
    { label: 'All contributors', value: '' },
    { label: 'Linked to Slack', value: 'linked' },
    { label: 'Not linked', value: 'unlinked' },
  ];

  protected readonly products = toSignal(this.productService.getAll().pipe(catchError(() => of([] as Product[]))), { initialValue: [] as Product[] });

  protected readonly productOptions: Signal<SelectOption[]> = computed(() => [
    { label: 'All products', value: '' },
    ...this.products().map((product) => ({ label: product.name, value: product.id })),
  ]);

  private readonly selectedProductId = toSignal(this.productFilterControl.valueChanges, { initialValue: this.productFilterControl.value });
  /** Sync is scoped to one product, mirroring release sync — an unscoped crawl would run every tracked repo inline. */
  protected readonly canSync: Signal<boolean> = computed(() => this.selectedProductId().length > 0);

  protected readonly pageState: Signal<ContributorPageState> = this.initPageState();
  protected readonly contributors = computed(() => this.pageState().contributors);
  protected readonly currentPage = computed(() => this.pageState().page);
  protected readonly totalPages = computed(() => this.pageState().totalPages);
  protected readonly totalItems = computed(() => this.pageState().total);
  protected readonly pageSize = computed(() => this.pageState().pageSize);
  /** Distinct product names per contributor — a contributor may appear in several repos of the same product. */
  protected readonly productNamesByContributor: Signal<Map<string, string[]>> = this.initProductNamesByContributor();
  protected readonly contributorMenuItems: Signal<Map<string, DropdownMenuItem[]>> = this.initContributorMenuItems();

  public constructor() {
    // Any filter change resets to page 1. merge, not combineLatest, so one control is enough;
    // the search leg repeats initPageState's debounce so a keystroke can't refetch on a stale query.
    merge(
      this.searchControl.valueChanges.pipe(debounceTime(ContributorsComponent.searchDebounceMs), distinctUntilChanged()),
      this.productFilterControl.valueChanges,
      this.slackFilterControl.valueChanges
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.page$.next(1));
  }

  protected onPageChange(page: number): void {
    this.page$.next(page);
  }

  protected syncContributors(): void {
    const productId = this.selectedProductId();
    if (!productId) return;

    this.syncing.set(true);
    this.contributorService.sync({ productId }).subscribe({
      next: (result) => {
        this.syncing.set(false);
        const summary = `${result.contributorsCreated} added, ${result.contributorsUpdated} updated, ${result.slackAutoLinked} auto-linked to Slack`;
        if (result.errors.length > 0) {
          this.toastService.warning(`Sync finished with ${result.errors.length} error(s) — ${summary}`);
        } else {
          this.toastService.success(`Sync complete — ${summary}`);
        }
        // Sync can remove stale repository links, shrinking the result set below the current page.
        this.page$.next(1);
        this.refresh$.next();
      },
      error: () => {
        this.syncing.set(false);
        this.toastService.error('Failed to sync contributors from GitHub');
      },
    });
  }

  protected openLinkDialog(contributor: ContributorWithRelations): void {
    this.dialogService.open({
      title: 'Link to Slack',
      size: 'sm',
      component: LinkSlackDialogComponent,
      inputs: { contributor },
      testId: 'link-slack-dialog',
      onClose: (result) => {
        if (result === 'saved') this.refresh$.next();
      },
    });
  }

  protected confirmUnlink(contributor: ContributorWithRelations): void {
    this.dialogService.open({
      title: 'Unlink Slack User',
      size: 'sm',
      component: ConfirmDialogComponent,
      inputs: {
        message: `Remove the Slack association from ${contributor.githubLogin}? They will no longer be mentioned in automated Slack messages.`,
        confirmLabel: 'Unlink',
        danger: true,
      },
      onClose: (result) => {
        if (result !== 'confirmed') return;
        this.contributorService.unlinkSlack(contributor.id).subscribe({
          next: () => {
            this.toastService.success(`Unlinked ${contributor.githubLogin} from Slack`);
            this.refresh$.next();
          },
          error: () => this.toastService.error(`Failed to unlink ${contributor.githubLogin}`),
        });
      },
    });
  }

  private confirmDelete(contributor: ContributorWithRelations): void {
    this.dialogService.open({
      title: 'Delete Contributor',
      size: 'sm',
      component: ConfirmDialogComponent,
      inputs: {
        message: `Permanently delete ${contributor.githubLogin}, including any Slack association? Contributor data comes from GitHub, so a later sync of a tracked repository will recreate the record.`,
        confirmLabel: 'Delete',
        danger: true,
      },
      onClose: (result) => {
        if (result !== 'confirmed') return;
        this.contributorService.delete(contributor.id).subscribe({
          next: () => {
            this.toastService.success(`Deleted ${contributor.githubLogin}`);
            // Removing the last row on the final page would otherwise refresh an out-of-range page.
            this.page$.next(1);
            this.refresh$.next();
          },
          error: () => this.toastService.error(`Failed to delete ${contributor.githubLogin}`),
        });
      },
    });
  }

  private initContributorMenuItems(): Signal<Map<string, DropdownMenuItem[]>> {
    return computed(() => {
      const menu = new Map<string, DropdownMenuItem[]>();
      for (const contributor of this.contributors()) {
        menu.set(contributor.id, [{ label: 'Delete contributor', action: () => this.confirmDelete(contributor), danger: true }]);
      }
      return menu;
    });
  }

  private initProductNamesByContributor(): Signal<Map<string, string[]>> {
    return computed(() => {
      const names = new Map<string, string[]>();
      for (const contributor of this.contributors()) {
        const distinct = [...new Set((contributor.repositories ?? []).map((repo) => repo.productName))].sort();
        names.set(contributor.id, distinct);
      }
      return names;
    });
  }

  private initPageState(): Signal<ContributorPageState> {
    return toSignal(
      combineLatest([
        this.searchControl.valueChanges.pipe(startWith(this.searchControl.value), debounceTime(ContributorsComponent.searchDebounceMs), distinctUntilChanged()),
        this.productFilterControl.valueChanges.pipe(startWith(this.productFilterControl.value)),
        this.slackFilterControl.valueChanges.pipe(startWith(this.slackFilterControl.value)),
        this.page$.pipe(distinctUntilChanged()),
        this.refresh$,
      ]).pipe(
        tap(() => this.loading.set(true)),
        switchMap(([query, productId, slackLink, page]) =>
          this.contributorService
            .getAll({
              ...(query ? { query } : {}),
              ...(productId ? { productId } : {}),
              ...(slackLink === 'linked' || slackLink === 'unlinked' ? { slackLink } : {}),
              page,
              limit: ContributorsComponent.defaultPageSize,
            })
            .pipe(
              map((res: PaginatedResponse<ContributorWithRelations>) => ({
                contributors: res.data,
                total: res.total,
                page: res.page,
                pageSize: res.pageSize,
                totalPages: res.totalPages,
              })),
              catchError(() => of(EMPTY_PAGE_STATE))
            )
        ),
        tap(() => this.loading.set(false))
      ),
      { initialValue: EMPTY_PAGE_STATE }
    );
  }
}
