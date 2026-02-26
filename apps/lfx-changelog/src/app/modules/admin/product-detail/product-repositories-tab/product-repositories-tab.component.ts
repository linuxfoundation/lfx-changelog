// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { DOCUMENT } from '@angular/common';
import { Component, computed, DestroyRef, inject, input, OnInit, Signal, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '@components/button/button.component';
import { CardComponent } from '@components/card/card.component';
import { DialogComponent } from '@components/dialog/dialog.component';
import { SelectComponent, SelectOption } from '@components/select/select.component';
import { GitHubService } from '@services/github/github.service';
import { ProductService } from '@services/product/product.service';
import { MapGetPipe } from '@shared/pipes/map-get/map-get.pipe';
import { catchError, forkJoin, map, of, startWith, Subject, switchMap, tap } from 'rxjs';

import type { GitHubInstallation, GitHubRepository, LinkRepositoryRequest, ProductRepository } from '@lfx-changelog/shared';
import type { LoadingState } from '@shared/interfaces/loading-state.interface';
@Component({
  selector: 'lfx-product-repositories-tab',
  imports: [ReactiveFormsModule, ButtonComponent, CardComponent, DialogComponent, SelectComponent, MapGetPipe],
  templateUrl: './product-repositories-tab.component.html',
  styleUrl: './product-repositories-tab.component.css',
})
export class ProductRepositoriesTabComponent implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly githubService = inject(GitHubService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  public readonly productId = input.required<string>();
  public readonly callbackInstallationId = input<string | null>(null);

  private readonly refresh$ = new Subject<void>();
  private readonly fetchInstallations$ = new Subject<void>();
  private readonly fetchRepos$ = new Subject<number>();

  protected readonly installationControl = new FormControl('', { nonNullable: true });

  protected readonly dialogVisible = signal(false);
  protected readonly dialogStep = signal<'select-installation' | 'select-repos'>('select-installation');
  protected readonly saving = signal(false);
  protected readonly selectedRepos = signal<Set<string>>(new Set());

  // Declarative data streams
  private readonly linkedReposState: Signal<LoadingState<ProductRepository[]>> = this.initLinkedReposState();
  private readonly installationsState: Signal<LoadingState<GitHubInstallation[]>> = this.initInstallationsState();
  private readonly availableReposState: Signal<LoadingState<GitHubRepository[]>> = this.initAvailableReposState();

  // Derived signals from state
  protected readonly linkedRepos = computed(() => this.linkedReposState().data);
  protected readonly loading = computed(() => this.linkedReposState().loading);
  protected readonly installations = computed(() => this.installationsState().data);
  protected readonly loadingInstallations = computed(() => this.installationsState().loading);
  protected readonly availableRepos = computed(() => this.availableReposState().data);
  protected readonly loadingRepos = computed(() => this.availableReposState().loading);

  protected readonly installationOptions: Signal<SelectOption[]> = this.initInstallationOptions();
  protected readonly repoSelectionMap: Signal<Map<string, boolean>> = this.initRepoSelectionMap();
  protected readonly selectedCount: Signal<number> = computed(() => this.selectedRepos().size);
  protected readonly dialogTitle = computed(() => (this.dialogStep() === 'select-installation' ? 'Select Organization' : 'Select Repositories'));

  public ngOnInit(): void {
    this.refresh$.next();

    const callbackId = this.callbackInstallationId();
    if (callbackId) {
      this.openAddDialog();
    }
  }

  protected openAddDialog(): void {
    this.dialogStep.set('select-installation');
    this.installationControl.setValue('');
    this.selectedRepos.set(new Set());
    this.dialogVisible.set(true);
    this.fetchInstallations$.next();
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

  protected goToSelectRepos(): void {
    const installationId = parseInt(this.installationControl.value, 10);
    if (!installationId) return;

    this.dialogStep.set('select-repos');
    this.selectedRepos.set(new Set());
    this.fetchRepos$.next(installationId);
  }

  protected goBackToInstallations(): void {
    this.dialogStep.set('select-installation');
  }

  protected toggleRepo(fullName: string): void {
    const current = new Set(this.selectedRepos());
    if (current.has(fullName)) {
      current.delete(fullName);
    } else {
      current.add(fullName);
    }
    this.selectedRepos.set(current);
  }

  protected linkSelected(): void {
    const selected = this.selectedRepos();
    if (selected.size === 0) return;

    const installationId = parseInt(this.installationControl.value, 10);
    const repos = this.availableRepos().filter((r) => selected.has(r.full_name));

    this.saving.set(true);

    const requests$ = repos.map((repo) => {
      const data: LinkRepositoryRequest = {
        githubInstallationId: installationId,
        owner: repo.owner.login,
        name: repo.name,
        fullName: repo.full_name,
        htmlUrl: repo.html_url,
        description: repo.description || undefined,
        isPrivate: repo.private,
      };
      return this.productService.linkRepository(this.productId(), data);
    });

    forkJoin(requests$)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogVisible.set(false);
          this.refresh$.next();
        },
        error: () => {
          this.saving.set(false);
          this.dialogVisible.set(false);
          this.refresh$.next();
        },
      });
  }

  protected unlinkRepository(repo: ProductRepository): void {
    this.productService
      .unlinkRepository(this.productId(), repo.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refresh$.next());
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

  private initInstallationsState(): Signal<LoadingState<GitHubInstallation[]>> {
    return toSignal(
      this.fetchInstallations$.pipe(
        switchMap(() =>
          this.githubService.getInstallations().pipe(
            map((data) => ({ data, loading: false })),
            catchError(() => of({ data: [] as GitHubInstallation[], loading: false })),
            startWith({ data: [] as GitHubInstallation[], loading: true })
          )
        ),
        tap((state) => {
          if (!state.loading) {
            const callbackId = this.callbackInstallationId();
            if (callbackId && state.data.length > 0) {
              this.installationControl.setValue(callbackId);
              this.goToSelectRepos();
            }
          }
        })
      ),
      { initialValue: { data: [], loading: false } }
    );
  }

  private initAvailableReposState(): Signal<LoadingState<GitHubRepository[]>> {
    return toSignal(
      this.fetchRepos$.pipe(
        switchMap((installationId) =>
          this.githubService.getInstallationRepositories(installationId).pipe(
            map((data) => ({ data, loading: false })),
            catchError(() => of({ data: [] as GitHubRepository[], loading: false })),
            startWith({ data: [] as GitHubRepository[], loading: true })
          )
        )
      ),
      { initialValue: { data: [], loading: false } }
    );
  }

  private initInstallationOptions(): Signal<SelectOption[]> {
    return computed(() =>
      this.installations().map((i) => ({
        label: i.account.login,
        value: String(i.id),
      }))
    );
  }

  private initRepoSelectionMap(): Signal<Map<string, boolean>> {
    return computed(() => {
      const selected = this.selectedRepos();
      const repoMap = new Map<string, boolean>();
      for (const repo of this.availableRepos()) {
        repoMap.set(repo.full_name, selected.has(repo.full_name));
      }
      return repoMap;
    });
  }
}
