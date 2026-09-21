// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { DOCUMENT } from '@angular/common';
import { Component, computed, DestroyRef, inject, input, OnInit, Signal, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ButtonComponent } from '@components/button/button.component';
import { CardComponent } from '@components/card/card.component';
import { TableColumnDirective } from '@components/table/table-column.directive';
import { TableComponent } from '@components/table/table.component';
import { CreateReleaseDialogComponent } from '@modules/admin/components/create-release-dialog/create-release-dialog.component';
import { LinkRepositoriesDialogComponent } from '@modules/admin/components/link-repositories-dialog/link-repositories-dialog.component';
import { ReleaseHistoryDialogComponent } from '@modules/admin/components/release-history-dialog/release-history-dialog.component';
import { AuthService } from '@services/auth.service';
import { DialogService } from '@services/dialog.service';
import { IntegrationsService } from '@services/integrations.service';
import { ProductService } from '@services/product.service';
import { ReleaseService } from '@services/release.service';
import { ToastService } from '@services/toast.service';
import { SetIncludesPipe } from '@shared/pipes/set-includes.pipe';
import { TimeAgoPipe } from '@shared/pipes/time-ago.pipe';
import { catchError, map, of, startWith, Subject, switchMap } from 'rxjs';

import type { ProductRepositoryWithCount } from '@lfx-changelog/shared';
import type { LoadingState } from '@shared/interfaces/loading-state.interface';

@Component({
  selector: 'lfx-product-repositories-tab',
  imports: [ButtonComponent, CardComponent, TableComponent, TableColumnDirective, SetIncludesPipe, TimeAgoPipe],
  templateUrl: './product-repositories-tab.component.html',
  styleUrl: './product-repositories-tab.component.css',
})
export class ProductRepositoriesTabComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly productService = inject(ProductService);
  private readonly releaseService = inject(ReleaseService);
  private readonly integrationsService = inject(IntegrationsService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  public readonly productId = input.required<string>();
  public readonly callbackInstallationId = input<string | null>(null);

  private readonly refresh$ = new Subject<void>();

  private readonly linkedReposState: Signal<LoadingState<ProductRepositoryWithCount[]>> = this.initLinkedReposState();

  // Editors can read this tab but can neither sync nor publish, so both actions are hidden
  // rather than offered and then rejected. The server remains the authority either way.
  protected readonly canAdministerProduct = computed(() => this.authService.canAdministerProduct(this.productId()));

  protected readonly syncingRepo = signal<Set<string>>(new Set());

  protected readonly linkedRepos = computed(() => this.linkedReposState().data);
  protected readonly loading = computed(() => this.linkedReposState().loading);

  public ngOnInit(): void {
    this.refresh$.next();

    const callbackId = this.callbackInstallationId();
    if (callbackId) {
      this.openAddDialog();
    }
  }

  protected openAddDialog(): void {
    this.dialogService.open({
      title: 'Select Organization',
      size: 'lg',
      component: LinkRepositoriesDialogComponent,
      inputs: {
        productId: this.productId(),
        callbackInstallationId: this.callbackInstallationId(),
      },
      onClose: (result) => {
        if (result === 'linked') this.refresh$.next();
      },
    });
  }

  protected openCreateRelease(repository: ProductRepositoryWithCount): void {
    this.dialogService.open({
      title: 'Create Release',
      component: CreateReleaseDialogComponent,
      size: 'lg',
      inputs: { repository },
      testId: 'create-release-dialog',
      onClose: (result) => {
        // The count shown in this table would otherwise sit stale until the release.published
        // webhook lands. Syncing pulls the release from GitHub and refreshes the table.
        if (result === 'created') this.syncRepository(repository);
      },
    });
  }

  protected syncRepository(repo: ProductRepositoryWithCount): void {
    this.syncingRepo.update((set) => new Set(set).add(repo.id));

    this.releaseService
      .syncRepository(repo.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.clearSyncing(repo.id);
          this.toastService.success('Repository synced');
          this.refresh$.next();
        },
        error: () => {
          this.clearSyncing(repo.id);
          this.toastService.error('Failed to sync repository');
        },
      });
  }

  protected openReleaseHistory(repository: ProductRepositoryWithCount): void {
    this.dialogService.open({
      title: 'Release History',
      component: ReleaseHistoryDialogComponent,
      size: 'lg',
      inputs: { repository },
      testId: 'release-history-dialog',
    });
  }

  protected installOnNewOrg(): void {
    this.integrationsService
      .getGitHubInstallUrl(this.productId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((url) => {
        const window = this.document.defaultView;
        if (window) {
          window.location.href = url;
        }
      });
  }

  protected unlinkRepository(repo: ProductRepositoryWithCount): void {
    this.productService
      .unlinkRepository(this.productId(), repo.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastService.success('Repository unlinked');
          this.refresh$.next();
        },
        error: () => this.toastService.error('Failed to unlink repository'),
      });
  }

  private clearSyncing(repoId: string): void {
    this.syncingRepo.update((set) => {
      const next = new Set(set);
      next.delete(repoId);
      return next;
    });
  }

  private initLinkedReposState(): Signal<LoadingState<ProductRepositoryWithCount[]>> {
    return toSignal(
      this.refresh$.pipe(
        switchMap(() =>
          this.productService.getRepositories(this.productId()).pipe(
            map((data) => ({ data, loading: false })),
            catchError(() => of({ data: [] as ProductRepositoryWithCount[], loading: false })),
            startWith({ data: [] as ProductRepositoryWithCount[], loading: true })
          )
        )
      ),
      { initialValue: { data: [], loading: true } }
    );
  }
}
