// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, DestroyRef, inject, signal, Signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonComponent } from '@components/button/button.component';
import { CardComponent } from '@components/card/card.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { InputComponent } from '@components/input/input.component';
import { MarkdownEditorComponent } from '@components/markdown-editor/markdown-editor.component';
import { MarkdownRendererComponent } from '@components/markdown-renderer/markdown-renderer.component';
import { SelectComponent } from '@components/select/select.component';
import { StatusBadgeComponent } from '@components/status-badge/status-badge.component';
import { BlogStatus, BlogType } from '@lfx-changelog/shared';
import { AuthService } from '@services/auth.service';
import { BlogService } from '@services/blog.service';
import { DialogService } from '@services/dialog.service';
import { ProductService } from '@services/product.service';
import { ToastService } from '@services/toast.service';
import { slugify } from '@shared/utils/slugify';
import { distinctUntilChanged, filter, map, switchMap, tap } from 'rxjs';

import type { BlogPostWithRelations, Product } from '@lfx-changelog/shared';
import type { SelectOption } from '@shared/interfaces/form.interface';
import type { Observable } from 'rxjs';

@Component({
  selector: 'lfx-blog-editor',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    InputComponent,
    MarkdownEditorComponent,
    MarkdownRendererComponent,
    SelectComponent,
    ButtonComponent,
    CardComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './blog-editor.component.html',
  styleUrl: './blog-editor.component.css',
})
export class BlogEditorComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly blogService = inject(BlogService);
  private readonly productService = inject(ProductService);
  private readonly authService = inject(AuthService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);

  protected readonly titleControl = new FormControl('', { nonNullable: true });
  protected readonly slugControl = new FormControl('', { nonNullable: true });
  protected readonly excerptControl = new FormControl('', { nonNullable: true });
  protected readonly descriptionControl = new FormControl('', { nonNullable: true });
  protected readonly typeControl = new FormControl(BlogType.MONTHLY_ROUNDUP, { nonNullable: true });
  protected readonly periodStartControl = new FormControl('', { nonNullable: true });
  protected readonly periodEndControl = new FormControl('', { nonNullable: true });

  private slugManuallyEdited = false;
  private settingSlugProgrammatically = false;

  protected readonly saving = signal(false);
  protected readonly publishing = signal(false);
  protected readonly unpublishing = signal(false);
  protected readonly deleting = signal(false);
  protected readonly loading = signal(false);
  protected readonly previewMode = signal<'desktop' | 'mobile'>('desktop');

  protected readonly products = toSignal(this.productService.getAll(), { initialValue: [] as Product[] });
  protected readonly existingEntry: Signal<BlogPostWithRelations | undefined> = this.initExistingEntry();
  protected readonly isEditing = computed(() => !!this.existingEntry());
  protected readonly isDraft = computed(() => this.existingEntry()?.status === BlogStatus.DRAFT);
  protected readonly previewStatus = computed(() => this.existingEntry()?.status ?? BlogStatus.DRAFT);

  protected readonly titleValue = toSignal(this.titleControl.valueChanges, { initialValue: this.titleControl.value });
  protected readonly slugValue = toSignal(this.slugControl.valueChanges, { initialValue: this.slugControl.value });
  protected readonly descriptionValue = toSignal(this.descriptionControl.valueChanges, { initialValue: this.descriptionControl.value });
  protected readonly hasSlug = computed(() => !!this.slugValue()?.trim());

  protected readonly typeOptions: SelectOption[] = [
    { label: 'Monthly Roundup', value: BlogType.MONTHLY_ROUNDUP },
    { label: 'Product Newsletter', value: BlogType.PRODUCT_NEWSLETTER },
  ];

  public constructor() {
    this.initSlugAutoGeneration();
  }

  protected generateSlugFromTitle(): void {
    const titleSlug = slugify(this.titleControl.value);
    const slug = `blog-${titleSlug}`;
    this.slugControl.setValue(slug);
  }

  protected save(): void {
    this.saving.set(true);
    this.buildSaveRequest$().subscribe({
      next: () => {
        this.saving.set(false);
        this.toastService.success('Blog post saved');
        this.router.navigate(['/admin/blog']);
      },
      error: () => {
        this.saving.set(false);
        this.toastService.error('Failed to save blog post');
      },
    });
  }

  protected publish(): void {
    this.publishing.set(true);
    this.buildSaveRequest$()
      .pipe(switchMap((post) => this.blogService.publish(post.id).pipe(map(() => post))))
      .subscribe({
        next: (post) => {
          this.publishing.set(false);
          this.toastService.success('Blog post published!');
          this.router.navigate(['/blog', post.slug]);
        },
        error: () => {
          this.publishing.set(false);
          this.toastService.error('Failed to publish blog post');
        },
      });
  }

  protected confirmUnpublish(): void {
    this.dialogService.open({
      title: 'Unpublish Blog Post',
      size: 'sm',
      component: ConfirmDialogComponent,
      inputs: {
        message: 'This will revert the blog post to draft and remove it from public view.',
        confirmLabel: 'Unpublish',
      },
      onClose: (result) => {
        if (result === 'confirmed') this.unpublish();
      },
    });
  }

  protected confirmDelete(): void {
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
        if (result === 'confirmed') this.deleteEntry();
      },
    });
  }

  private unpublish(): void {
    const entry = this.existingEntry();
    if (!entry) return;

    this.unpublishing.set(true);
    this.blogService.unpublish(entry.id).subscribe({
      next: () => {
        this.unpublishing.set(false);
        this.toastService.success('Blog post unpublished');
        this.router.navigate(['/admin/blog']);
      },
      error: () => {
        this.unpublishing.set(false);
        this.toastService.error('Failed to unpublish blog post');
      },
    });
  }

  private deleteEntry(): void {
    const entry = this.existingEntry();
    if (!entry) return;

    this.deleting.set(true);
    this.blogService.remove(entry.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.toastService.success('Blog post deleted');
        this.router.navigate(['/admin/blog']);
      },
      error: () => {
        this.deleting.set(false);
        this.toastService.error('Failed to delete blog post');
      },
    });
  }

  private buildSaveRequest$(): Observable<BlogPostWithRelations> {
    const existing = this.existingEntry();

    return existing
      ? this.blogService.update(existing.id, {
          title: this.titleControl.value,
          slug: this.slugControl.value,
          excerpt: this.excerptControl.value || undefined,
          description: this.descriptionControl.value,
          type: this.typeControl.value,
          periodStart: this.periodStartControl.value || undefined,
          periodEnd: this.periodEndControl.value || undefined,
        })
      : this.blogService.create({
          title: this.titleControl.value,
          slug: this.slugControl.value || undefined,
          excerpt: this.excerptControl.value || undefined,
          description: this.descriptionControl.value,
          type: this.typeControl.value,
          status: BlogStatus.DRAFT,
          periodStart: this.periodStartControl.value || undefined,
          periodEnd: this.periodEndControl.value || undefined,
        });
  }

  private initExistingEntry(): Signal<BlogPostWithRelations | undefined> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return signal(undefined);

    this.loading.set(true);
    return toSignal(
      this.blogService.getById(id).pipe(
        tap((entry) => {
          this.titleControl.setValue(entry.title);
          this.slugControl.setValue(entry.slug ?? '');
          this.slugManuallyEdited = true;
          this.excerptControl.setValue(entry.excerpt ?? '');
          this.descriptionControl.setValue(entry.description);
          this.typeControl.setValue(entry.type as BlogType);
          this.periodStartControl.setValue(entry.periodStart ? entry.periodStart.substring(0, 10) : '');
          this.periodEndControl.setValue(entry.periodEnd ? entry.periodEnd.substring(0, 10) : '');
          this.loading.set(false);
        })
      )
    );
  }

  private initSlugAutoGeneration(): void {
    toObservable(this.titleValue)
      .pipe(
        filter((title) => !this.slugManuallyEdited && title.trim().length > 0),
        map((title) => `blog-${slugify(title)}`),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((slug) => {
        this.settingSlugProgrammatically = true;
        this.slugControl.setValue(slug);
        this.settingSlugProgrammatically = false;
      });

    this.slugControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (!this.settingSlugProgrammatically) {
        this.slugManuallyEdited = true;
      }
    });
  }
}
