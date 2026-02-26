import { Component, DestroyRef, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonComponent } from '@components/button/button.component';
import { CardComponent } from '@components/card/card.component';
import { DialogComponent } from '@components/dialog/dialog.component';
import { InputComponent } from '@components/input/input.component';
import { TextareaComponent } from '@components/textarea/textarea.component';
import { ProductService } from '@services/product/product.service';
import { BehaviorSubject, catchError, of, switchMap, tap } from 'rxjs';

import type { Product } from '@lfx-changelog/shared';
@Component({
  selector: 'lfx-product-management',
  imports: [ReactiveFormsModule, RouterLink, ButtonComponent, CardComponent, DialogComponent, InputComponent, TextareaComponent],
  templateUrl: './product-management.component.html',
  styleUrl: './product-management.component.css',
})
export class ProductManagementComponent {
  private readonly productService = inject(ProductService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);

  protected readonly products = toSignal(
    this.refresh$.pipe(
      tap(() => this.loading.set(true)),
      switchMap(() => this.productService.getAll().pipe(catchError(() => of([] as Product[])))),
      tap(() => this.loading.set(false))
    ),
    { initialValue: [] as Product[] }
  );

  protected readonly formNameControl = new FormControl('', { nonNullable: true });
  protected readonly formSlugControl = new FormControl('', { nonNullable: true });
  protected readonly formDescriptionControl = new FormControl('', { nonNullable: true });

  protected readonly dialogVisible = signal(false);
  protected readonly editingProduct = signal<Product | null>(null);

  protected openAdd(): void {
    this.editingProduct.set(null);
    this.formNameControl.setValue('');
    this.formSlugControl.setValue('');
    this.formDescriptionControl.setValue('');
    this.dialogVisible.set(true);
  }

  protected openEdit(product: Product): void {
    this.editingProduct.set(product);
    this.formNameControl.setValue(product.name);
    this.formSlugControl.setValue(product.slug);
    this.formDescriptionControl.setValue(product.description);
    this.dialogVisible.set(true);
  }

  protected saveProduct(): void {
    this.saving.set(true);
    const data = {
      name: this.formNameControl.value,
      slug: this.formSlugControl.value,
      description: this.formDescriptionControl.value,
    };

    const editing = this.editingProduct();
    const request$ = editing ? this.productService.update(editing.id, data) : this.productService.create(data);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogVisible.set(false);
        this.refresh$.next();
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  protected deleteProduct(product: Product): void {
    this.productService
      .delete(product.id)
      .subscribe(() => this.refresh$.next());
  }
}
