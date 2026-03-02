// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ButtonComponent } from '@components/button/button.component';
import { RepositoryService } from '@services/repository/repository.service';
import { TimeAgoPipe } from '@shared/pipes/time-ago/time-ago.pipe';
import { BehaviorSubject, catchError, of, switchMap, tap } from 'rxjs';

import type { RepositoryWithCounts } from '@lfx-changelog/shared';

interface ProductGroup {
  productId: string;
  productName: string;
  productFaIcon: string | null;
  repos: RepositoryWithCounts[];
  totalReleases: number;
}

@Component({
  selector: 'lfx-repository-list',
  imports: [ButtonComponent, TimeAgoPipe],
  templateUrl: './repository-list.component.html',
  styleUrl: './repository-list.component.css',
})
export class RepositoryListComponent {
  private readonly repositoryService = inject(RepositoryService);
  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  protected readonly loading = signal(true);
  protected readonly syncingProduct = signal<Set<string>>(new Set());
  protected readonly syncingRepo = signal<Set<string>>(new Set());
  protected readonly collapsedGroups = signal<Set<string>>(new Set());

  protected readonly repositories = toSignal(
    this.refresh$.pipe(
      tap(() => this.loading.set(true)),
      switchMap(() => this.repositoryService.getAll().pipe(catchError(() => of([] as RepositoryWithCounts[])))),
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

  protected isGroupCollapsed(productId: string): boolean {
    return this.collapsedGroups().has(productId);
  }

  protected syncProduct(productId: string): void {
    this.syncingProduct.update((set) => new Set(set).add(productId));

    this.repositoryService.syncProduct(productId).subscribe({
      next: () => {
        this.syncingProduct.update((set) => {
          const next = new Set(set);
          next.delete(productId);
          return next;
        });
        this.refresh$.next();
      },
      error: () => {
        this.syncingProduct.update((set) => {
          const next = new Set(set);
          next.delete(productId);
          return next;
        });
      },
    });
  }

  protected syncRepository(repoId: string): void {
    this.syncingRepo.update((set) => new Set(set).add(repoId));

    this.repositoryService.syncRepository(repoId).subscribe({
      next: () => {
        this.syncingRepo.update((set) => {
          const next = new Set(set);
          next.delete(repoId);
          return next;
        });
        this.refresh$.next();
      },
      error: () => {
        this.syncingRepo.update((set) => {
          const next = new Set(set);
          next.delete(repoId);
          return next;
        });
      },
    });
  }

  protected isSyncingProduct(productId: string): boolean {
    return this.syncingProduct().has(productId);
  }

  protected isSyncingRepo(repoId: string): boolean {
    return this.syncingRepo().has(repoId);
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
