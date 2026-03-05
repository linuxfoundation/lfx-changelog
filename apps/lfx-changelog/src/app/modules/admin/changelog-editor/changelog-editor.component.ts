// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, DestroyRef, inject, signal, Signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonComponent } from '@components/button/button.component';
import { CardComponent } from '@components/card/card.component';
import { ChangelogCardComponent } from '@components/changelog-card/changelog-card.component';
import { InputComponent } from '@components/input/input.component';
import { MarkdownEditorComponent } from '@components/markdown-editor/markdown-editor.component';
import { MarkdownRendererComponent } from '@components/markdown-renderer/markdown-renderer.component';
import { PostToSlackDialogComponent } from '@components/post-to-slack-dialog/post-to-slack-dialog.component';
import { ProductPillComponent } from '@components/product-pill/product-pill.component';
import { SelectComponent } from '@components/select/select.component';
import { StatusBadgeComponent } from '@components/status-badge/status-badge.component';
import { TextareaComponent } from '@components/textarea/textarea.component';
import { ChangelogStatus, UserRole } from '@lfx-changelog/shared';
import { AiService } from '@services/ai/ai.service';
import { AuthService } from '@services/auth/auth.service';
import { ChangelogService } from '@services/changelog/changelog.service';
import { ProductService } from '@services/product/product.service';
import { UserService } from '@services/user/user.service';
import { slugify } from '@shared/utils/slugify';
import { catchError, combineLatest, distinctUntilChanged, filter, map, of, pairwise, startWith, switchMap, tap } from 'rxjs';

import type { ChangelogEntryWithRelations, Product, ProductRepository, User } from '@lfx-changelog/shared';
import type { SelectOption } from '@shared/interfaces/form.interface';
import type { LoadingState } from '@shared/interfaces/loading-state.interface';
import type { Observable } from 'rxjs';

@Component({
  selector: 'lfx-changelog-editor',
  imports: [
    ReactiveFormsModule,
    InputComponent,
    MarkdownEditorComponent,
    SelectComponent,
    ButtonComponent,
    CardComponent,
    MarkdownRendererComponent,
    ChangelogCardComponent,
    ProductPillComponent,
    StatusBadgeComponent,
    TextareaComponent,
    RouterLink,
    PostToSlackDialogComponent,
  ],
  templateUrl: './changelog-editor.component.html',
  styleUrl: './changelog-editor.component.css',
})
export class ChangelogEditorComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changelogService = inject(ChangelogService);
  private readonly productService = inject(ProductService);
  protected readonly aiService = inject(AiService);
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);

  protected readonly products = toSignal(this.productService.getAll(), { initialValue: [] as Product[] });
  protected readonly isSuperAdmin = computed(() => this.authService.dbUser()?.roles?.some((r) => r.role === UserRole.SUPER_ADMIN) ?? false);
  private readonly allUsers: Signal<User[]> = this.initAllUsers();

  protected readonly titleControl = new FormControl('', { nonNullable: true });
  protected readonly slugControl = new FormControl('', { nonNullable: true });
  protected readonly descriptionControl = new FormControl('', { nonNullable: true });
  protected readonly versionControl = new FormControl('', { nonNullable: true });
  protected readonly productIdControl = new FormControl('', { nonNullable: true });
  protected readonly releaseCountControl = new FormControl('1', { nonNullable: true });
  protected readonly additionalContextControl = new FormControl('', { nonNullable: true });
  protected readonly authorControl = new FormControl('', { nonNullable: true });

  private slugManuallyEdited = false;
  private settingSlugProgrammatically = false;

  protected readonly saving = signal(false);
  protected readonly publishing = signal(false);
  protected readonly loading = signal(false);
  protected readonly showAiPanel = signal(false);
  protected readonly justPublished = signal(false);
  protected readonly slackDialogVisible = signal(false);

  protected readonly existingEntry: Signal<ChangelogEntryWithRelations | undefined> = this.initExistingEntry();
  protected readonly isEditing = computed(() => !!this.existingEntry());
  protected readonly isDraft = computed(() => this.existingEntry()?.status === ChangelogStatus.DRAFT);

  protected readonly isGenerating = computed(() => this.aiService.state().generating);
  protected readonly generationStatus = computed(() => this.aiService.state().status);
  protected readonly generationError = computed(() => this.aiService.state().error);

  protected readonly titleValue = toSignal(this.titleControl.valueChanges, { initialValue: this.titleControl.value });
  protected readonly slugValue = toSignal(this.slugControl.valueChanges, { initialValue: this.slugControl.value });
  protected readonly descriptionValue = toSignal(this.descriptionControl.valueChanges, { initialValue: this.descriptionControl.value });
  protected readonly versionValue = toSignal(this.versionControl.valueChanges, { initialValue: this.versionControl.value });
  private readonly productIdValue = toSignal(this.productIdControl.valueChanges, { initialValue: this.productIdControl.value });

  protected readonly productOptions: Signal<SelectOption[]> = this.initProductOptions();
  protected readonly authorOptions: Signal<SelectOption[]> = this.initAuthorOptions();
  protected readonly previewEntry: Signal<ChangelogEntryWithRelations> = this.initPreviewEntry();
  protected readonly selectedProduct: Signal<Product | undefined> = this.initSelectedProduct();
  protected readonly repoState: Signal<LoadingState<ProductRepository[]>> = this.initRepoState();
  protected readonly hasGitHubRepos = computed(() => this.repoState().data.length > 0);
  protected readonly loadingRepos = computed(() => this.repoState().loading);
  protected readonly hasSlug = computed(() => !!this.slugValue()?.trim());

  protected readonly releaseCountOptions: SelectOption[] = Array.from({ length: 50 }, (_, i) => ({
    label: `${i + 1}`,
    value: `${i + 1}`,
  }));

  public constructor() {
    this.initAiStateWatcher();
    this.initSlugAutoGeneration();
  }

  protected toggleAiPanel(): void {
    this.showAiPanel.update((v) => !v);
  }

  protected generateChangelog(): void {
    const productId = this.productIdControl.value;
    const releaseCount = parseInt(this.releaseCountControl.value, 10);
    const additionalContext = this.additionalContextControl.value || undefined;

    this.titleControl.setValue('');
    this.descriptionControl.setValue('');
    this.versionControl.setValue('');

    this.aiService.generateChangelog({ productId, releaseCount, additionalContext });
  }

  protected cancelGeneration(): void {
    this.aiService.abort();
  }

  protected dismissError(): void {
    this.aiService.reset();
  }

  protected generateSlugFromTitle(): void {
    const product = this.selectedProduct();
    const titleSlug = slugify(this.titleControl.value);
    const slug = product ? `${product.slug}-${titleSlug}` : titleSlug;
    this.slugControl.setValue(slug);
  }

  protected save(): void {
    this.saving.set(true);
    this.buildSaveRequest$().subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/admin/changelogs']);
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  protected publish(): void {
    this.publishing.set(true);
    this.buildSaveRequest$()
      .pipe(switchMap((entry) => this.changelogService.publish(entry.id).pipe(map(() => entry))))
      .subscribe({
        next: (entry) => {
          this.publishing.set(false);
          this.justPublished.set(true);
          // For new entries, navigate to edit URL so post-to-slack dialog has the entry ID
          if (!this.route.snapshot.paramMap.get('id')) {
            this.router.navigate(['/admin/changelogs', entry.id, 'edit'], { replaceUrl: true });
          }
        },
        error: () => {
          this.publishing.set(false);
        },
      });
  }

  protected openSlackDialog(): void {
    this.slackDialogVisible.set(true);
  }

  protected goToList(): void {
    this.router.navigate(['/admin/changelogs']);
  }

  private buildSaveRequest$(): Observable<ChangelogEntryWithRelations> {
    const existing = this.existingEntry();
    return existing
      ? this.changelogService.update(existing.id, {
          slug: this.slugControl.value,
          title: this.titleControl.value,
          description: this.descriptionControl.value,
          version: this.versionControl.value,
          createdBy: this.authorControl.value || undefined,
        })
      : this.changelogService.create({
          slug: this.slugControl.value,
          title: this.titleControl.value,
          description: this.descriptionControl.value,
          version: this.versionControl.value,
          productId: this.productIdControl.value,
          status: ChangelogStatus.DRAFT,
        });
  }

  private initAiStateWatcher(): void {
    toObservable(this.aiService.state)
      .pipe(pairwise(), takeUntilDestroyed(this.destroyRef))
      .subscribe(([prev, curr]) => {
        if (curr.title && curr.title !== prev.title) {
          this.titleControl.setValue(curr.title);
        }
        if (curr.version && curr.version !== prev.version) {
          this.versionControl.setValue(curr.version);
        }
        if (curr.description !== prev.description) {
          this.descriptionControl.setValue(curr.description);
        }
      });
  }

  private initExistingEntry(): Signal<ChangelogEntryWithRelations | undefined> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return signal(undefined);

    this.loading.set(true);
    return toSignal(
      this.changelogService.getById(id).pipe(
        tap((entry) => {
          this.titleControl.setValue(entry.title);
          this.slugControl.setValue(entry.slug ?? '');
          this.slugManuallyEdited = true;
          this.descriptionControl.setValue(entry.description);
          this.versionControl.setValue(entry.version ?? '');
          this.productIdControl.setValue(entry.productId);
          this.authorControl.setValue(entry.createdBy);
          this.loading.set(false);
        })
      )
    );
  }

  private initProductOptions(): Signal<SelectOption[]> {
    return computed(() => this.products().map((p) => ({ label: p.name, value: p.id })));
  }

  private initPreviewEntry(): Signal<ChangelogEntryWithRelations> {
    return computed(() => ({
      id: this.existingEntry()?.id ?? 'preview',
      productId: this.productIdValue(),
      slug: this.slugValue() || null,
      title: this.titleValue() || 'Untitled Entry',
      description: this.descriptionValue(),
      version: this.versionValue() || '0.0.0',
      status: this.existingEntry()?.status ?? ChangelogStatus.DRAFT,
      publishedAt: null,
      createdBy: 'preview-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      product: this.products().find((p) => p.id === this.productIdValue()),
    }));
  }

  private initSelectedProduct(): Signal<Product | undefined> {
    return computed(() => this.products().find((p) => p.id === this.productIdValue()));
  }

  private initSlugAutoGeneration(): void {
    // Auto-generate slug from title + product slug for new entries
    combineLatest([toObservable(this.titleValue), toObservable(this.selectedProduct)])
      .pipe(
        filter(([title]) => !this.slugManuallyEdited && title.trim().length > 0),
        map(([title, product]) => {
          const titleSlug = slugify(title);
          return product ? `${product.slug}-${titleSlug}` : titleSlug;
        }),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((slug) => {
        this.settingSlugProgrammatically = true;
        this.slugControl.setValue(slug);
        this.settingSlugProgrammatically = false;
      });

    // Detect manual slug edits (ignore programmatic updates)
    this.slugControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (!this.settingSlugProgrammatically) {
        this.slugManuallyEdited = true;
      }
    });
  }

  private initRepoState(): Signal<LoadingState<ProductRepository[]>> {
    const emptyState: LoadingState<ProductRepository[]> = { loading: false, data: [] };

    return toSignal(
      this.productIdControl.valueChanges.pipe(
        tap(() => this.showAiPanel.set(false)),
        switchMap((productId) => {
          if (!productId) return of(emptyState);

          return this.productService.getRepositories(productId).pipe(
            map((data): LoadingState<ProductRepository[]> => ({ loading: false, data })),
            catchError(() => of(emptyState)),
            startWith({ loading: true, data: [] } as LoadingState<ProductRepository[]>)
          );
        })
      ),
      { initialValue: emptyState }
    );
  }

  private initAllUsers(): Signal<User[]> {
    return toSignal(toObservable(this.isSuperAdmin).pipe(switchMap((isSuperAdmin) => (isSuperAdmin ? this.userService.getAll() : of([] as User[])))), {
      initialValue: [] as User[],
    });
  }

  private initAuthorOptions(): Signal<SelectOption[]> {
    return computed(() => {
      if (this.isSuperAdmin()) {
        return this.allUsers().map((u) => ({ label: u.name, value: u.id }));
      }
      const currentUser = this.authService.dbUser();
      return currentUser ? [{ label: currentUser.name, value: currentUser.id }] : [];
    });
  }
}
