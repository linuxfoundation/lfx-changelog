// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, inject, input, OnInit, signal, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { BadgeComponent } from '@components/badge/badge.component';
import { ButtonComponent } from '@components/button/button.component';
import { SelectComponent } from '@components/select/select.component';
import { UserRole } from '@lfx-changelog/shared';
import { DialogService } from '@services/dialog/dialog.service';
import { ToastService } from '@services/toast/toast.service';
import { UserService } from '@services/user/user.service';
import { ProductNamePipe } from '@shared/pipes/product-name/product-name.pipe';
import { RoleColorPipe } from '@shared/pipes/role-color/role-color.pipe';
import { RoleLabelPipe } from '@shared/pipes/role-label/role-label.pipe';

import type { Product, User, UserRoleAssignment } from '@lfx-changelog/shared';
import type { SelectOption } from '@shared/interfaces/form.interface';

@Component({
  selector: 'lfx-manage-roles-dialog',
  imports: [ReactiveFormsModule, BadgeComponent, ButtonComponent, SelectComponent, ProductNamePipe, RoleColorPipe, RoleLabelPipe],
  templateUrl: './manage-roles-dialog.component.html',
  styleUrl: './manage-roles-dialog.component.css',
})
export class ManageRolesDialogComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly toastService = inject(ToastService);
  protected readonly dialogService = inject(DialogService);

  public readonly user = input.required<User>();
  public readonly products = input.required<Product[]>();

  protected readonly newRoleControl = new FormControl('', { nonNullable: true });
  protected readonly newProductControl = new FormControl('', { nonNullable: true });

  protected readonly roles = signal<UserRoleAssignment[]>([]);
  private modified = false;

  protected readonly roleOptions: SelectOption[] = [
    { label: 'Super Admin', value: UserRole.SUPER_ADMIN },
    { label: 'Product Admin', value: UserRole.PRODUCT_ADMIN },
    { label: 'Editor', value: UserRole.EDITOR },
  ];

  protected readonly newSelectedRole = toSignal(this.newRoleControl.valueChanges, { initialValue: '' });
  protected readonly newRoleIsSuperAdmin: Signal<boolean> = computed(() => this.newSelectedRole() === UserRole.SUPER_ADMIN);

  protected readonly productOptions: Signal<SelectOption[]> = computed(() => [
    { label: 'Global (all products)', value: '' },
    ...this.products().map((p) => ({ label: p.name, value: p.id })),
  ]);

  public ngOnInit(): void {
    this.roles.set(this.user().roles ?? []);
  }

  protected assignRole(): void {
    const user = this.user();
    if (!user || !this.newRoleControl.value) return;

    const productId = this.newRoleControl.value === UserRole.SUPER_ADMIN ? null : this.newProductControl.value || null;
    this.userService.assignRole(user.id, this.newRoleControl.value, productId).subscribe({
      next: () => {
        this.toastService.success('Role assigned');
        this.dialogService.close('changed');
      },
      error: () => this.toastService.error('Failed to assign role'),
    });
  }

  protected removeRole(roleId: string): void {
    this.userService.removeRole(this.user().id, roleId).subscribe({
      next: () => {
        this.modified = true;
        this.roles.update((r) => r.filter((role) => role.id !== roleId));
        this.toastService.success('Role removed');
      },
      error: () => this.toastService.error('Failed to remove role'),
    });
  }

  protected close(): void {
    this.dialogService.close(this.modified ? 'changed' : undefined);
  }
}
