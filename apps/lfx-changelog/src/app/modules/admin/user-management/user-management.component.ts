// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AvatarComponent } from '@components/avatar/avatar.component';
import { BadgeComponent } from '@components/badge/badge.component';
import { ButtonComponent } from '@components/button/button.component';
import { CardComponent } from '@components/card/card.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { TableColumnDirective } from '@components/table/table-column.directive';
import { TableComponent } from '@components/table/table.component';
import { UserRole } from '@lfx-changelog/shared';
import { AddUserDialogComponent } from '@modules/admin/components/add-user-dialog/add-user-dialog.component';
import { ManageRolesDialogComponent } from '@modules/admin/components/manage-roles-dialog/manage-roles-dialog.component';
import { AuthService } from '@services/auth.service';
import { DialogService } from '@services/dialog.service';
import { ProductService } from '@services/product.service';
import { ToastService } from '@services/toast.service';
import { UserService } from '@services/user.service';
import { ProductNamePipe } from '@shared/pipes/product-name.pipe';
import { RoleColorPipe } from '@shared/pipes/role-color.pipe';
import { RoleLabelPipe } from '@shared/pipes/role-label.pipe';
import { BehaviorSubject, catchError, of, switchMap, tap } from 'rxjs';

import type { Product, User } from '@lfx-changelog/shared';

const SELF_REMOVE_REASON = 'You cannot remove your own account';
const LAST_SUPER_ADMIN_REASON = 'The last Super Admin cannot be removed';

@Component({
  selector: 'lfx-user-management',
  imports: [
    AvatarComponent,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    TableComponent,
    TableColumnDirective,
    ProductNamePipe,
    RoleColorPipe,
    RoleLabelPipe,
  ],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.css',
})
export class UserManagementComponent {
  private readonly userService = inject(UserService);
  private readonly productService = inject(ProductService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly authService = inject(AuthService);
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

  protected readonly currentUserId = computed(() => this.authService.dbUser()?.id);

  private readonly lastSuperAdminId = computed(() => {
    const superAdmins = this.users().filter((user) => user.roles?.some((role) => role.role === UserRole.SUPER_ADMIN));
    return superAdmins.length === 1 ? superAdmins[0]?.id : undefined;
  });

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

  protected removeBlockedReason(user: User): string | null {
    if (user.id === this.currentUserId()) return SELF_REMOVE_REASON;
    if (user.id === this.lastSuperAdminId()) return LAST_SUPER_ADMIN_REASON;
    return null;
  }

  protected removeAriaLabel(user: User): string {
    return this.removeBlockedReason(user) ?? `Remove ${user.name}`;
  }

  protected openRemoveDialog(user: User): void {
    if (this.removeBlockedReason(user)) return;

    this.dialogService.open({
      title: 'Remove User',
      size: 'sm',
      component: ConfirmDialogComponent,
      testId: 'user-management-remove-dialog',
      inputs: {
        message: `Remove ${user.name} (${user.email}) from the Users list? They will lose all changelog admin access. This cannot be undone.`,
        confirmLabel: 'Remove',
        danger: true,
      },
      onClose: (result) => {
        if (result === 'confirmed') this.removeUser(user);
      },
    });
  }

  private removeUser(user: User): void {
    this.userService.delete(user.id).subscribe({
      next: () => {
        this.toastService.success(`${user.name} removed`);
        this.refreshUsers$.next();
      },
      error: () => this.toastService.error('Failed to remove user'),
    });
  }
}
