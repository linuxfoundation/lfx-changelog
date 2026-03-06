// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { DOCUMENT } from '@angular/common';
import { Component, computed, DestroyRef, inject, input, OnInit, signal, Signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '@components/button/button.component';
import { SelectComponent } from '@components/select/select.component';
import { DialogService } from '@services/dialog/dialog.service';
import { GitHubService } from '@services/github/github.service';
import { ProductService } from '@services/product/product.service';
import { ToastService } from '@services/toast/toast.service';
import { catchError, forkJoin, map, of, startWith, Subject, switchMap } from 'rxjs';

import type { GitHubInstallation, GitHubRepository, LinkRepositoryRequest } from '@lfx-changelog/shared';
import type { SelectOption } from '@shared/interfaces/form.interface';
import type { LoadingState } from '@shared/interfaces/loading-state.interface';

@Component({
  selector: 'lfx-link-repositories-dialog',
  imports: [ReactiveFormsModule, ButtonComponent, SelectComponent],
  templateUrl: './link-repositories-dialog.component.html',
  styleUrl: './link-repositories-dialog.component.css',
})
export class LinkRepositoriesDialogComponent implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly githubService = inject(GitHubService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly toastService = inject(ToastService);
  protected readonly dialogService = inject(DialogService);

  public readonly productId = input.required<string>();
  public readonly callbackInstallationId = input<string | null>(null);

  private readonly fetchInstallations$ = new Subject<void>();
  private readonly fetchRepos$ = new Subject<number>();

  protected readonly installationControl = new FormControl('', { nonNullable: true });

  protected readonly dialogStep = signal<'select-installation' | 'select-repos'>('select-installation');
  protected readonly saving = signal(false);
  protected readonly selectedRepos = signal<Set<string>>(new Set());
  protected readonly repoControls = signal<Record<string, FormControl<boolean>>>({});

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
          this.toastService.success('Repositories linked');
          this.dialogService.close('linked');
        },
        error: () => {
          this.saving.set(false);
          this.toastService.error('Failed to link repositories');
          this.dialogService.close();
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
            map((data) => {
              this.setupRepoControls(data);
              return { data, loading: false };
            }),
            catchError(() => of({ data: [] as GitHubRepository[], loading: false })),
            startWith({ data: [] as GitHubRepository[], loading: true })
          )
        )
      ),
      { initialValue: { data: [], loading: false } }
    );
  }

  private setupRepoControls(repos: GitHubRepository[]): void {
    const controls: Record<string, FormControl<boolean>> = {};
    for (const repo of repos) {
      const ctrl = new FormControl(false, { nonNullable: true });
      ctrl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((checked) => {
        const current = new Set(this.selectedRepos());
        if (checked) {
          current.add(repo.full_name);
        } else {
          current.delete(repo.full_name);
        }
        this.selectedRepos.set(current);
      });
      controls[repo.full_name] = ctrl;
    }
    this.repoControls.set(controls);
  }
}
