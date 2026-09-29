// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, inject, Signal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AvatarComponent } from '@components/avatar/avatar.component';
import { BadgeComponent } from '@components/badge/badge.component';
import { ButtonComponent } from '@components/button/button.component';
import { CardComponent } from '@components/card/card.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { TableColumnDirective } from '@components/table/table-column.directive';
import { TableComponent } from '@components/table/table.component';
import { BOT_EMAIL, UserRole } from '@lfx-changelog/shared';
import { AddUserDialogComponent } from '@modules/admin/components/add-user-dialog/add-user-dialog.component';
import { EditUserDialogComponent } from '@modules/admin/components/edit-user-dialog/edit-user-dialog.component';
import { ManageRolesDialogComponent } from '@modules/admin/components/manage-roles-dialog/manage-roles-dialog.component';
import { AuthService } from '@services/auth.service';
import { DialogService } from '@services/dialog.service';
import { ProductService } from '@services/product.service';
import { ToastService } from '@services/toast.service';
import { UserService } from '@services/user.service';
import { ProductNamePipe } from '@shared/pipes/product-name.pipe';
import { RoleColorPipe } from '@shared/pipes/role-color.pipe';
import { RoleLabelPipe } from '@shared/pipes/role-label.pipe';
import { apiErrorMessage } from '@shared/utils/api-error-message';
import { BehaviorSubject, catchError, of, switchMap, tap } from 'rxjs';

import type { Product, User } from '@lfx-changelog/shared';

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

  protected readonly deactivateBlockedReasons: Signal<Map<string, string>> = this.initDeactivateBlockedReasons();

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

  protected openEditDialog(user: User): void {
    this.dialogService.open({
      title: 'Edit User',
      component: EditUserDialogComponent,
      inputs: { user, isSelf: user.id === this.authService.dbUser()?.id },
      testId: 'edit-user-dialog',
      onClose: (result) => {
        if (result === 'updated') this.refreshUsers$.next();
      },
    });
  }

  protected openDeactivateDialog(user: User): void {
    if (this.deactivateBlockedReasons().has(user.id)) return;

    this.dialogService.open({
      title: 'Deactivate User',
      size: 'sm',
      component: ConfirmDialogComponent,
      testId: 'user-management-deactivate-dialog',
      inputs: {
        message: `Deactivate ${user.name} (${user.email})? All of their roles are removed, their API keys are revoked, and they're unsubscribed from Slack draft notifications. Their published posts are unchanged, and you can reactivate them later.`,
        confirmLabel: 'Deactivate',
        danger: true,
      },
      onClose: (result) => {
        if (result === 'confirmed') this.deactivate(user);
      },
    });
  }

  protected reactivate(user: User): void {
    this.userService.reactivate(user.id).subscribe({
      next: () => {
        this.toastService.success(`${user.name} reactivated. Assign roles to restore their access.`);
        this.refreshUsers$.next();
      },
      error: (err: unknown) => this.toastService.error(apiErrorMessage(err, 'Failed to reactivate user')),
    });
  }

  private initDeactivateBlockedReasons(): Signal<Map<string, string>> {
    return computed(() => {
      const users = this.users();
      const currentUserId = this.authService.dbUser()?.id;
      const superAdmins = users.filter((user) => user.roles?.some((role) => role.role === UserRole.SUPER_ADMIN));
      const reasons = new Map<string, string>();
      for (const user of users) {
        if (user.id === currentUserId) reasons.set(user.id, 'You cannot deactivate your own account');
        else if (user.email === BOT_EMAIL) reasons.set(user.id, 'The automation bot cannot be deactivated');
        else if (superAdmins.length === 1 && superAdmins[0]?.id === user.id) reasons.set(user.id, 'The last Super Admin cannot be deactivated');
      }
      return reasons;
    });
  }

  private deactivate(user: User): void {
    this.userService.deactivate(user.id).subscribe({
      next: () => {
        this.toastService.success(`${user.name} deactivated`);
        this.refreshUsers$.next();
      },
      error: (err: unknown) => this.toastService.error(apiErrorMessage(err, 'Failed to deactivate user')),
    });
  }
}
