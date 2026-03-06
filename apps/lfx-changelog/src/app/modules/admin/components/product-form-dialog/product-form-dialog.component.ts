// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, inject, input, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '@components/button/button.component';
import { InputComponent } from '@components/input/input.component';
import { TextareaComponent } from '@components/textarea/textarea.component';
import { DialogService } from '@services/dialog/dialog.service';
import { ProductService } from '@services/product/product.service';
import { ToastService } from '@services/toast/toast.service';

import type { Product } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-product-form-dialog',
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent, TextareaComponent],
  templateUrl: './product-form-dialog.component.html',
  styleUrl: './product-form-dialog.component.css',
})
export class ProductFormDialogComponent implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly toastService = inject(ToastService);
  protected readonly dialogService = inject(DialogService);

  public readonly product = input<Product | null>(null);

  protected readonly formNameControl = new FormControl('', { nonNullable: true });
  protected readonly formSlugControl = new FormControl('', { nonNullable: true });
  protected readonly formDescriptionControl = new FormControl('', { nonNullable: true });
  protected readonly formFaIconControl = new FormControl('', { nonNullable: true });
  protected readonly iconPreview = toSignal(this.formFaIconControl.valueChanges, { initialValue: '' });

  protected readonly saving = signal(false);

  public ngOnInit(): void {
    const p = this.product();
    if (p) {
      this.formNameControl.setValue(p.name);
      this.formSlugControl.setValue(p.slug);
      this.formDescriptionControl.setValue(p.description ?? '');
      this.formFaIconControl.setValue(p.faIcon ?? '');
    }
  }

  protected save(): void {
    this.saving.set(true);
    const data = {
      name: this.formNameControl.value,
      slug: this.formSlugControl.value,
      description: this.formDescriptionControl.value,
      faIcon: this.formFaIconControl.value || undefined,
    };

    const editing = this.product();
    const request$ = editing ? this.productService.update(editing.id, data) : this.productService.create(data);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.toastService.success(editing ? 'Product updated' : 'Product created');
        this.dialogService.close('saved');
      },
      error: () => {
        this.saving.set(false);
        this.toastService.error('Failed to save product');
      },
    });
  }
}
