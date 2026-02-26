import { Component, computed, inject, signal, type Signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ChangelogStatus, MOCK_CHANGELOG_ENTRIES, MOCK_PRODUCTS } from '@lfx-changelog/shared';
import type { ChangelogEntry, Product } from '@lfx-changelog/shared';
import type { SelectOption } from '@shared/interfaces/form.interface';
import { ButtonComponent } from '@components/button/button.component';
import { CardComponent } from '@components/card/card.component';
import { ChangelogCardComponent } from '@components/changelog-card/changelog-card.component';
import { InputComponent } from '@components/input/input.component';
import { MarkdownRendererComponent } from '@components/markdown-renderer/markdown-renderer.component';
import { ProductPillComponent } from '@components/product-pill/product-pill.component';
import { SelectComponent } from '@components/select/select.component';
import { StatusBadgeComponent } from '@components/status-badge/status-badge.component';
import { MarkdownEditorComponent } from '@components/markdown-editor/markdown-editor.component';

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

  protected readonly productOptions: SelectOption[] = MOCK_PRODUCTS.map((p) => ({ label: p.name, value: p.id }));

  private readonly existingEntry = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return undefined;
    return MOCK_CHANGELOG_ENTRIES.find((e) => e.id === id);
  });

  protected readonly isEditing = computed(() => !!this.existingEntry());

  protected readonly titleControl = new FormControl(this.existingEntry()?.title ?? '', { nonNullable: true });
  protected readonly descriptionControl = new FormControl(this.existingEntry()?.description ?? '', { nonNullable: true });
  protected readonly versionControl = new FormControl(this.existingEntry()?.version ?? '', { nonNullable: true });
  protected readonly productIdControl = new FormControl(this.existingEntry()?.productId ?? '', { nonNullable: true });
  protected readonly saving = signal(false);

  protected readonly titleValue = toSignal(this.titleControl.valueChanges, { initialValue: this.titleControl.value });
  protected readonly descriptionValue = toSignal(this.descriptionControl.valueChanges, { initialValue: this.descriptionControl.value });
  protected readonly versionValue = toSignal(this.versionControl.valueChanges, { initialValue: this.versionControl.value });

  protected readonly previewEntry: Signal<ChangelogEntry> = this.initPreviewEntry();
  protected readonly selectedProduct: Signal<Product | undefined> = this.initSelectedProduct();

  protected save(): void {
    this.saving.set(true);
    setTimeout(() => {
      this.saving.set(false);
      this.router.navigate(['/admin/changelogs']);
    }, 800);
  }

  private initPreviewEntry(): Signal<ChangelogEntry> {
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
    }));
  }

  private initSelectedProduct(): Signal<Product | undefined> {
    const productId = toSignal(this.productIdControl.valueChanges, { initialValue: this.productIdControl.value });
    return computed(() => MOCK_PRODUCTS.find((p) => p.id === productId()));
  }
}
