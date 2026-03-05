// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ButtonComponent } from '@components/button/button.component';
import { TableColumnDirective } from '@components/table/table-column.directive';
import { TableComponent } from '@components/table/table.component';
import { ProductFormDialogComponent } from '@modules/admin/components/product-form-dialog/product-form-dialog.component';
import { DialogService } from '@services/dialog/dialog.service';
import { ProductService } from '@services/product/product.service';
import { BehaviorSubject, catchError, of, switchMap, tap } from 'rxjs';

import type { Product } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-product-management',
  imports: [RouterLink, ButtonComponent, TableComponent, TableColumnDirective],
  templateUrl: './product-management.component.html',
  styleUrl: './product-management.component.css',
})
export class ProductManagementComponent {
  private readonly productService = inject(ProductService);
  private readonly dialogService = inject(DialogService);
  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  protected readonly loading = signal(true);

  protected readonly products = toSignal(
    this.refresh$.pipe(
      tap(() => this.loading.set(true)),
      switchMap(() => this.productService.getAll().pipe(catchError(() => of([] as Product[])))),
      tap(() => this.loading.set(false))
    ),
    { initialValue: [] as Product[] }
  );

  protected openAdd(): void {
    this.dialogService.open({
      title: 'Add Product',
      component: ProductFormDialogComponent,
      testId: 'product-dialog',
      onClose: (result) => {
        if (result === 'saved') this.refresh$.next();
      },
    });
  }

  protected openEdit(product: Product): void {
    this.dialogService.open({
      title: 'Edit Product',
      component: ProductFormDialogComponent,
      inputs: { product },
      testId: 'product-dialog',
      onClose: (result) => {
        if (result === 'saved') this.refresh$.next();
      },
    });
  }

  protected deleteProduct(product: Product): void {
    this.productService.delete(product.id).subscribe(() => this.refresh$.next());
  }
}
