// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { DOCUMENT } from '@angular/common';
import { Component, computed, DestroyRef, inject, input, OnInit, Signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ButtonComponent } from '@components/button/button.component';
import { CardComponent } from '@components/card/card.component';
import { TableColumnDirective } from '@components/table/table-column.directive';
import { TableComponent } from '@components/table/table.component';
import { LinkRepositoriesDialogComponent } from '@modules/admin/components/link-repositories-dialog/link-repositories-dialog.component';
import { DialogService } from '@services/dialog/dialog.service';
import { GitHubService } from '@services/github/github.service';
import { ProductService } from '@services/product/product.service';
import { ToastService } from '@services/toast/toast.service';
import { catchError, map, of, startWith, Subject, switchMap } from 'rxjs';

import type { ProductRepository } from '@lfx-changelog/shared';
import type { LoadingState } from '@shared/interfaces/loading-state.interface';

@Component({
  selector: 'lfx-product-repositories-tab',
  imports: [ButtonComponent, CardComponent, TableComponent, TableColumnDirective],
  templateUrl: './product-repositories-tab.component.html',
  styleUrl: './product-repositories-tab.component.css',
})
export class ProductRepositoriesTabComponent implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly githubService = inject(GitHubService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  public readonly productId = input.required<string>();
  public readonly callbackInstallationId = input<string | null>(null);

  private readonly refresh$ = new Subject<void>();

  private readonly linkedReposState: Signal<LoadingState<ProductRepository[]>> = this.initLinkedReposState();

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

  protected installOnNewOrg(): void {
    this.githubService
      .getInstallUrl(this.productId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((url) => {
        const window = this.document.defaultView;
        if (window) {
          window.location.href = url;
        }
      });
  }

  protected unlinkRepository(repo: ProductRepository): void {
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

  private initLinkedReposState(): Signal<LoadingState<ProductRepository[]>> {
    return toSignal(
      this.refresh$.pipe(
        switchMap(() =>
          this.productService.getRepositories(this.productId()).pipe(
            map((data) => ({ data, loading: false })),
            catchError(() => of({ data: [] as ProductRepository[], loading: false })),
            startWith({ data: [] as ProductRepository[], loading: true })
          )
        )
      ),
      { initialValue: { data: [], loading: true } }
    );
  }
}
