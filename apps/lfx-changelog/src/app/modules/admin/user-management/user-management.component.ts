// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AvatarComponent } from '@components/avatar/avatar.component';
import { BadgeComponent } from '@components/badge/badge.component';
import { ButtonComponent } from '@components/button/button.component';
import { TableColumnDirective } from '@components/table/table-column.directive';
import { TableComponent } from '@components/table/table.component';
import { AddUserDialogComponent } from '@modules/admin/components/add-user-dialog/add-user-dialog.component';
import { ManageRolesDialogComponent } from '@modules/admin/components/manage-roles-dialog/manage-roles-dialog.component';
import { DialogService } from '@services/dialog/dialog.service';
import { ProductService } from '@services/product/product.service';
import { UserService } from '@services/user/user.service';
import { ProductNamePipe } from '@shared/pipes/product-name/product-name.pipe';
import { RoleColorPipe } from '@shared/pipes/role-color/role-color.pipe';
import { RoleLabelPipe } from '@shared/pipes/role-label/role-label.pipe';
import { BehaviorSubject, catchError, of, switchMap, tap } from 'rxjs';

import type { Product, User } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-user-management',
  imports: [AvatarComponent, BadgeComponent, ButtonComponent, TableComponent, TableColumnDirective, ProductNamePipe, RoleColorPipe, RoleLabelPipe],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.css',
})
export class UserManagementComponent {
  private readonly userService = inject(UserService);
  private readonly productService = inject(ProductService);
  private readonly dialogService = inject(DialogService);
  private readonly refreshUsers$ = new BehaviorSubject<void>(undefined);

  protected readonly loading = signal(true);

  protected readonly users = toSignal(
    this.refreshUsers$.pipe(
      tap(() => this.loading.set(true)),
      switchMap(() => this.userService.getAll().pipe(catchError(() => of([] as User[])))),
      tap(() => this.loading.set(false))
    ),
    { initialValue: [] as User[] }
  );

  protected readonly products = toSignal(this.productService.getAll(), { initialValue: [] as Product[] });
  private readonly activeProducts = computed(() => this.products().filter((p) => p.isActive));

  protected openAddUserDialog(): void {
    this.dialogService.open({
      title: 'Add User',
      component: AddUserDialogComponent,
      inputs: { products: this.activeProducts() },
      testId: 'add-user-dialog',
      onClose: (result) => {
        if (result === 'created') this.refreshUsers$.next();
      },
    });
  }

  protected openRoleDialog(user: User): void {
    this.dialogService.open({
      title: 'Manage Roles',
      component: ManageRolesDialogComponent,
      inputs: { user, products: this.activeProducts() },
      testId: 'user-role-dialog',
      onClose: (result) => {
        if (result === 'changed') this.refreshUsers$.next();
      },
    });
  }
}
