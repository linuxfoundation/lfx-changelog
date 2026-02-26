import { Component, computed, inject, signal, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonComponent } from '@components/button/button.component';
import { CardComponent } from '@components/card/card.component';
import { ChangelogCardComponent } from '@components/changelog-card/changelog-card.component';
import { InputComponent } from '@components/input/input.component';
import { MarkdownEditorComponent } from '@components/markdown-editor/markdown-editor.component';
import { MarkdownRendererComponent } from '@components/markdown-renderer/markdown-renderer.component';
import { ProductPillComponent } from '@components/product-pill/product-pill.component';
import { SelectComponent } from '@components/select/select.component';
import { StatusBadgeComponent } from '@components/status-badge/status-badge.component';
import type { ChangelogEntryWithRelations, Product } from '@lfx-changelog/shared';
import { ChangelogStatus } from '@lfx-changelog/shared';
import { ChangelogService } from '@services/changelog/changelog.service';
import { ProductService } from '@services/product/product.service';
import type { SelectOption } from '@shared/interfaces/form.interface';
import { tap } from 'rxjs';

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
    RouterLink,
  ],
  templateUrl: './changelog-editor.component.html',
  styleUrl: './changelog-editor.component.css',
})
export class ChangelogEditorComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly changelogService = inject(ChangelogService);
  private readonly productService = inject(ProductService);

  protected readonly products = toSignal(this.productService.getAll(), { initialValue: [] as Product[] });

  protected readonly titleControl = new FormControl('', { nonNullable: true });
  protected readonly descriptionControl = new FormControl('', { nonNullable: true });
  protected readonly versionControl = new FormControl('', { nonNullable: true });
  protected readonly productIdControl = new FormControl('', { nonNullable: true });
  protected readonly saving = signal(false);
  protected readonly loading = signal(false);

  protected readonly existingEntry: Signal<ChangelogEntryWithRelations | undefined> = this.initExistingEntry();
  protected readonly isEditing = computed(() => !!this.existingEntry());

  protected readonly titleValue = toSignal(this.titleControl.valueChanges, { initialValue: this.titleControl.value });
  protected readonly descriptionValue = toSignal(this.descriptionControl.valueChanges, { initialValue: this.descriptionControl.value });
  protected readonly versionValue = toSignal(this.versionControl.valueChanges, { initialValue: this.versionControl.value });

  protected readonly productOptions: Signal<SelectOption[]> = this.initProductOptions();
  protected readonly previewEntry: Signal<ChangelogEntryWithRelations> = this.initPreviewEntry();
  protected readonly selectedProduct: Signal<Product | undefined> = this.initSelectedProduct();

  protected save(): void {
    this.saving.set(true);
    const data = {
      title: this.titleControl.value,
      description: this.descriptionControl.value,
      version: this.versionControl.value,
      productId: this.productIdControl.value,
      status: ChangelogStatus.DRAFT,
    };

    const request$ = this.existingEntry() ? this.changelogService.update(this.existingEntry()!.id, data) : this.changelogService.create(data);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/admin/changelogs']);
      },
      error: () => {
        this.saving.set(false);
      },
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
          this.descriptionControl.setValue(entry.description);
          this.versionControl.setValue(entry.version);
          this.productIdControl.setValue(entry.productId);
          this.loading.set(false);
        })
      )
    );
  }

  private initProductOptions(): Signal<SelectOption[]> {
    return computed(() => this.products().map((p) => ({ label: p.name, value: p.id })));
  }

  private initPreviewEntry(): Signal<ChangelogEntryWithRelations> {
    const productId = toSignal(this.productIdControl.valueChanges, { initialValue: this.productIdControl.value });

    return computed(() => ({
      id: this.existingEntry()?.id ?? 'preview',
      productId: productId(),
      title: this.titleValue() || 'Untitled Entry',
      description: this.descriptionValue(),
      version: this.versionValue() || '0.0.0',
      status: ChangelogStatus.DRAFT,
      publishedAt: null,
      createdBy: 'preview-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      product: this.products().find((p) => p.id === productId()),
    }));
  }

  private initSelectedProduct(): Signal<Product | undefined> {
    const productId = toSignal(this.productIdControl.valueChanges, { initialValue: this.productIdControl.value });
    return computed(() => this.products().find((p) => p.id === productId()));
  }
}
