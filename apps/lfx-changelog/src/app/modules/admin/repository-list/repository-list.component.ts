// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ButtonComponent } from '@components/button/button.component';
import { ReleaseService } from '@services/release.service';
import { ToastService } from '@services/toast.service';
import { SetIncludesPipe } from '@shared/pipes/set-includes.pipe';
import { TimeAgoPipe } from '@shared/pipes/time-ago.pipe';
import { BehaviorSubject, catchError, of, switchMap, tap } from 'rxjs';

import type { RepositoryWithCounts } from '@lfx-changelog/shared';
import type { ProductGroup } from '@shared/interfaces/repository.interface';

@Component({
  selector: 'lfx-repository-list',
  imports: [ButtonComponent, SetIncludesPipe, TimeAgoPipe],
  templateUrl: './repository-list.component.html',
  styleUrl: './repository-list.component.css',
})
export class RepositoryListComponent {
  private readonly releaseService = inject(ReleaseService);
  private readonly toastService = inject(ToastService);
  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  protected readonly loading = signal(true);
  protected readonly syncingProduct = signal<Set<string>>(new Set());
  protected readonly syncingRepo = signal<Set<string>>(new Set());
  protected readonly collapsedGroups = signal<Set<string>>(new Set());

  protected readonly repositories = toSignal(
    this.refresh$.pipe(
      tap(() => this.loading.set(true)),
      switchMap(() => this.releaseService.getRepositories().pipe(catchError(() => of([] as RepositoryWithCounts[])))),
      tap(() => this.loading.set(false))
    ),
    { initialValue: [] as RepositoryWithCounts[] }
  );

  protected readonly groupedByProduct: ReturnType<typeof computed<ProductGroup[]>> = this.initGroupedByProduct();

  protected toggleGroup(productId: string): void {
    this.collapsedGroups.update((set) => {
      const next = new Set(set);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }

  protected syncProduct(productId: string): void {
    this.syncingProduct.update((set) => new Set(set).add(productId));

    this.releaseService.syncProduct(productId).subscribe({
      next: () => {
        this.syncingProduct.update((set) => {
          const next = new Set(set);
          next.delete(productId);
          return next;
        });
        this.toastService.success('Product synced');
        this.refresh$.next();
      },
      error: () => {
        this.syncingProduct.update((set) => {
          const next = new Set(set);
          next.delete(productId);
          return next;
        });
        this.toastService.error('Failed to sync product');
      },
    });
  }

  protected syncRepository(repoId: string): void {
    this.syncingRepo.update((set) => new Set(set).add(repoId));

    this.releaseService.syncRepository(repoId).subscribe({
      next: () => {
        this.syncingRepo.update((set) => {
          const next = new Set(set);
          next.delete(repoId);
          return next;
        });
        this.toastService.success('Repository synced');
        this.refresh$.next();
      },
      error: () => {
        this.syncingRepo.update((set) => {
          const next = new Set(set);
          next.delete(repoId);
          return next;
        });
        this.toastService.error('Failed to sync repository');
      },
    });
  }

  private initGroupedByProduct() {
    return computed(() => {
      const repos = this.repositories();
      const groupMap = new Map<string, ProductGroup>();

      for (const repo of repos) {
        let group = groupMap.get(repo.productId);
        if (!group) {
          group = {
            productId: repo.productId,
            productName: repo.productName,
            productFaIcon: repo.productFaIcon,
            repos: [],
            totalReleases: 0,
          };
          groupMap.set(repo.productId, group);
        }
        group.repos.push(repo);
        group.totalReleases += repo.releaseCount;
      }

      return Array.from(groupMap.values()).sort((a, b) => a.productName.localeCompare(b.productName));
    });
  }
}
