// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { DOCUMENT } from '@angular/common';
import { Component, computed, DestroyRef, inject, input, OnInit, signal, Signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '@components/button/button.component';
import { SelectComponent, SelectOption } from '@components/select/select.component';
import { DialogService } from '@services/dialog/dialog.service';
import { GitHubService } from '@services/github/github.service';
import { ProductService } from '@services/product/product.service';
import { MapGetPipe } from '@shared/pipes/map-get/map-get.pipe';
import { catchError, forkJoin, map, of, startWith, Subject, switchMap } from 'rxjs';

import type { GitHubInstallation, GitHubRepository, LinkRepositoryRequest } from '@lfx-changelog/shared';
import type { LoadingState } from '@shared/interfaces/loading-state.interface';

@Component({
  selector: 'lfx-link-repositories-dialog',
  imports: [ReactiveFormsModule, ButtonComponent, SelectComponent, MapGetPipe],
  templateUrl: './link-repositories-dialog.component.html',
  styleUrl: './link-repositories-dialog.component.css',
})
export class LinkRepositoriesDialogComponent implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly githubService = inject(GitHubService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  protected readonly dialogService = inject(DialogService);

  public readonly productId = input.required<string>();
  public readonly callbackInstallationId = input<string | null>(null);

  private readonly fetchInstallations$ = new Subject<void>();
  private readonly fetchRepos$ = new Subject<number>();

  protected readonly installationControl = new FormControl('', { nonNullable: true });

  protected readonly dialogStep = signal<'select-installation' | 'select-repos'>('select-installation');
  protected readonly saving = signal(false);
  protected readonly selectedRepos = signal<Set<string>>(new Set());

  private readonly installationsState: Signal<LoadingState<GitHubInstallation[]>> = this.initInstallationsState();
  private readonly availableReposState: Signal<LoadingState<GitHubRepository[]>> = this.initAvailableReposState();

  protected readonly installations = computed(() => this.installationsState().data);
  protected readonly loadingInstallations = computed(() => this.installationsState().loading);
  protected readonly availableRepos = computed(() => this.availableReposState().data);
  protected readonly loadingRepos = computed(() => this.availableReposState().loading);

  protected readonly installationOptions: Signal<SelectOption[]> = computed(() =>
    this.installations().map((i) => ({
      label: i.account.login,
      value: String(i.id),
    }))
  );
  protected readonly repoSelectionMap: Signal<Map<string, boolean>> = this.initRepoSelectionMap();
  protected readonly selectedCount: Signal<number> = computed(() => this.selectedRepos().size);

  public ngOnInit(): void {
    this.fetchInstallations$.next();
    this.updateDialogTitle();

    const callbackId = this.callbackInstallationId();
    if (callbackId) {
      this.installationControl.setValue(callbackId);
    }
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
    this.updateDialogTitle();
  }

  protected goBackToInstallations(): void {
    this.dialogStep.set('select-installation');
    this.updateDialogTitle();
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
          this.dialogService.close('linked');
        },
        error: () => {
          this.saving.set(false);
          this.dialogService.close('linked');
        },
      });
  }

  private updateDialogTitle(): void {
    const title = this.dialogStep() === 'select-installation' ? 'Select Organization' : 'Select Repositories';
    this.dialogService.updateTitle(title);
  }

  private initInstallationsState(): Signal<LoadingState<GitHubInstallation[]>> {
    return toSignal(
      this.fetchInstallations$.pipe(
        switchMap(() =>
          this.githubService.getInstallations().pipe(
            map((data) => {
              const callbackId = this.callbackInstallationId();
              if (callbackId && data.length > 0) {
                this.installationControl.setValue(callbackId);
                this.goToSelectRepos();
              }
              return { data, loading: false };
            }),
            catchError(() => of({ data: [] as GitHubInstallation[], loading: false })),
            startWith({ data: [] as GitHubInstallation[], loading: true })
          )
        )
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
