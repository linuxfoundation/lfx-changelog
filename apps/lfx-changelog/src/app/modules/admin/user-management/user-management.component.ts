// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, inject, signal, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AvatarComponent } from '@components/avatar/avatar.component';
import { BadgeComponent } from '@components/badge/badge.component';
import { ButtonComponent } from '@components/button/button.component';
import { DialogComponent } from '@components/dialog/dialog.component';
import { InputComponent } from '@components/input/input.component';
import { SelectComponent } from '@components/select/select.component';
import { TableColumnDirective } from '@components/table/table-column.directive';
import { TableComponent } from '@components/table/table.component';
import { UserRole } from '@lfx-changelog/shared';
import { ProductService } from '@services/product/product.service';
import { UserService } from '@services/user/user.service';
import { ProductNamePipe } from '@shared/pipes/product-name/product-name.pipe';
import { RoleColorPipe } from '@shared/pipes/role-color/role-color.pipe';
import { RoleLabelPipe } from '@shared/pipes/role-label/role-label.pipe';
import { BehaviorSubject, switchMap, tap } from 'rxjs';

import type { Product, User } from '@lfx-changelog/shared';
import type { SelectOption } from '@shared/interfaces/form.interface';

@Component({
  selector: 'lfx-user-management',
  imports: [
    ReactiveFormsModule,
    AvatarComponent,
    BadgeComponent,
    ButtonComponent,
    DialogComponent,
    InputComponent,
    SelectComponent,
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
  private readonly refreshUsers$ = new BehaviorSubject<void>(undefined);

  protected readonly loading = signal(true);

  protected readonly users = toSignal(
    this.refreshUsers$.pipe(
      tap(() => this.loading.set(true)),
      switchMap(() => this.userService.getAll()),
      tap(() => this.loading.set(false))
    ),
    { initialValue: [] as User[] }
  );

  protected readonly products = toSignal(this.productService.getAll(), { initialValue: [] as Product[] });

  // Role management dialog
  protected readonly newRoleControl = new FormControl('', { nonNullable: true });
  protected readonly newProductControl = new FormControl('', { nonNullable: true });
  protected readonly dialogVisible = signal(false);
  protected readonly selectedUser = signal<User | null>(null);

  // Add user dialog
  protected readonly addUserEmailControl = new FormControl('', { nonNullable: true });
  protected readonly addUserNameControl = new FormControl('', { nonNullable: true });
  protected readonly addUserRoleControl = new FormControl('', { nonNullable: true });
  protected readonly addUserProductControl = new FormControl('', { nonNullable: true });
  protected readonly addUserDialogVisible = signal(false);
  protected readonly addUserError = signal('');

  protected readonly roleOptions: SelectOption[] = [
    { label: 'Super Admin', value: UserRole.SUPER_ADMIN },
    { label: 'Product Admin', value: UserRole.PRODUCT_ADMIN },
    { label: 'Editor', value: UserRole.EDITOR },
  ];

  protected readonly addUserRoleOptions: SelectOption[] = [
    { label: 'Super Admin', value: UserRole.SUPER_ADMIN },
    { label: 'Product Admin', value: UserRole.PRODUCT_ADMIN },
    { label: 'Editor', value: UserRole.EDITOR },
  ];

  protected readonly addUserSelectedRole = toSignal(this.addUserRoleControl.valueChanges, { initialValue: '' });
  protected readonly newSelectedRole = toSignal(this.newRoleControl.valueChanges, { initialValue: '' });
  protected readonly addUserIsSuperAdmin: Signal<boolean> = computed(() => this.addUserSelectedRole() === UserRole.SUPER_ADMIN);
  protected readonly newRoleIsSuperAdmin: Signal<boolean> = computed(() => this.newSelectedRole() === UserRole.SUPER_ADMIN);

  protected readonly productOptions: Signal<SelectOption[]> = this.initProductOptions();

  protected openAddUserDialog(): void {
    this.addUserEmailControl.setValue('');
    this.addUserNameControl.setValue('');
    this.addUserRoleControl.setValue(UserRole.EDITOR);
    this.addUserProductControl.setValue('');
    this.addUserError.set('');
    this.addUserDialogVisible.set(true);
  }

  protected createUser(): void {
    const email = this.addUserEmailControl.value.trim();
    const name = this.addUserNameControl.value.trim();
    const role = this.addUserRoleControl.value;
    if (!email || !name || !role) return;

    this.addUserError.set('');
    const isSuperAdmin = role === UserRole.SUPER_ADMIN;
    const productId = isSuperAdmin ? undefined : this.addUserProductControl.value || undefined;

    this.userService.create({ email, name, role: role as any, productId }).subscribe({
      next: () => {
        this.addUserDialogVisible.set(false);
        this.refreshUsers$.next();
      },
      error: (err: any) => {
        this.addUserError.set(err?.error?.error || 'Failed to create user');
      },
    });
  }

  protected openRoleDialog(user: User): void {
    this.selectedUser.set(user);
    this.newRoleControl.setValue('');
    this.newProductControl.setValue('');
    this.dialogVisible.set(true);
  }

  protected assignRole(): void {
    const user = this.selectedUser();
    if (!user || !this.newRoleControl.value) return;

    const productId = this.newRoleControl.value === UserRole.SUPER_ADMIN ? null : this.newProductControl.value || null;
    this.userService.assignRole(user.id, this.newRoleControl.value, productId).subscribe(() => {
      this.dialogVisible.set(false);
      this.refreshUsers$.next();
    });
  }

  protected removeRole(user: User, roleId: string): void {
    this.userService.removeRole(user.id, roleId).subscribe(() => this.refreshUsers$.next());
  }

  private initProductOptions(): Signal<SelectOption[]> {
    return computed(() => [{ label: 'Global (all products)', value: '' }, ...this.products().map((p) => ({ label: p.name, value: p.id }))]);
  }
}
