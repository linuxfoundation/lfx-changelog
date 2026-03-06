// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, inject, signal, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BadgeComponent } from '@components/badge/badge.component';
import { ButtonComponent } from '@components/button/button.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { DropdownMenuComponent } from '@components/dropdown-menu/dropdown-menu.component';
import { TableColumnDirective } from '@components/table/table-column.directive';
import { TableComponent } from '@components/table/table.component';
import { ProductFormDialogComponent } from '@modules/admin/components/product-form-dialog/product-form-dialog.component';
import { DialogService } from '@services/dialog/dialog.service';
import { ProductService } from '@services/product/product.service';
import { MapGetPipe } from '@shared/pipes/map-get/map-get.pipe';
import { BehaviorSubject, catchError, of, switchMap, tap } from 'rxjs';

import type { Product } from '@lfx-changelog/shared';
import type { DropdownMenuItem } from '@shared/interfaces/form.interface';

@Component({
  selector: 'lfx-product-management',
  imports: [RouterLink, BadgeComponent, ButtonComponent, DropdownMenuComponent, TableComponent, TableColumnDirective, MapGetPipe],
  templateUrl: './product-management.component.html',
  styleUrl: './product-management.component.css',
})
export class ProductManagementComponent {
  private readonly productService = inject(ProductService);
  private readonly dialogService = inject(DialogService);
  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  protected readonly loading = signal(true);
  protected readonly actionMessage = signal('');
  protected readonly actionIsError = signal(false);

  private actionSuccessTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly products = toSignal(
    this.refresh$.pipe(
      tap(() => this.loading.set(true)),
      switchMap(() => this.productService.getAll().pipe(catchError(() => of([] as Product[])))),
      tap(() => this.loading.set(false))
    ),
    { initialValue: [] as Product[] }
  );

  protected readonly productMenuItems: Signal<Map<string, DropdownMenuItem[]>> = this.initProductMenuItems();

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

  private toggleActive(product: Product): void {
    const newActive = !product.isActive;
    const label = newActive ? 'enabled' : 'disabled';

    const doUpdate = (): void => {
      this.productService.update(product.id, { isActive: newActive }).subscribe({
        next: () => {
          this.showActionMessage(`${product.name} ${label}`);
          this.refresh$.next();
        },
        error: () => this.showActionMessage(`Failed to ${newActive ? 'enable' : 'disable'} ${product.name}`, true),
      });
    };

    if (newActive) {
      doUpdate();
    } else {
      this.dialogService.open({
        title: 'Disable Product',
        size: 'sm',
        component: ConfirmDialogComponent,
        inputs: {
          message: `This will hide "${product.name}" from the public changelog. Existing entries will be preserved.`,
          confirmLabel: 'Disable',
          danger: true,
        },
        onClose: (result) => {
          if (result === 'confirmed') doUpdate();
        },
      });
    }
  }

  private confirmDelete(product: Product): void {
    this.dialogService.open({
      title: 'Delete Product',
      size: 'sm',
      component: ConfirmDialogComponent,
      inputs: {
        message: `This will permanently delete "${product.name}" and all its changelog entries. This action cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
      },
      onClose: (result) => {
        if (result === 'confirmed') {
          this.productService.delete(product.id).subscribe({
            next: () => {
              this.showActionMessage(`${product.name} deleted`);
              this.refresh$.next();
            },
            error: () => this.showActionMessage(`Failed to delete ${product.name}`, true),
          });
        }
      },
    });
  }

  private showActionMessage(message: string, isError = false): void {
    if (this.actionSuccessTimer) clearTimeout(this.actionSuccessTimer);
    this.actionMessage.set(message);
    this.actionIsError.set(isError);
    this.actionSuccessTimer = setTimeout(() => this.actionMessage.set(''), 4000);
  }

  private initProductMenuItems(): Signal<Map<string, DropdownMenuItem[]>> {
    return computed(() => {
      const products = this.products();
      const menuMap = new Map<string, DropdownMenuItem[]>();

      for (const product of products) {
        const items: DropdownMenuItem[] = [
          { label: 'Edit', action: () => this.openEdit(product) },
          {
            label: product.isActive ? 'Disable' : 'Enable',
            action: () => this.toggleActive(product),
            danger: product.isActive,
          },
          { label: 'Delete', action: () => this.confirmDelete(product), danger: true },
        ];
        menuMap.set(product.id, items);
      }

      return menuMap;
    });
  }
}
