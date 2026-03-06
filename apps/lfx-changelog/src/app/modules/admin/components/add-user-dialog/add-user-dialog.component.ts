// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, inject, input, Signal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '@components/button/button.component';
import { InputComponent } from '@components/input/input.component';
import { SelectComponent } from '@components/select/select.component';
import { UserRole } from '@lfx-changelog/shared';
import { DialogService } from '@services/dialog/dialog.service';
import { ToastService } from '@services/toast/toast.service';
import { UserService } from '@services/user/user.service';

import type { Product } from '@lfx-changelog/shared';
import type { SelectOption } from '@shared/interfaces/form.interface';

@Component({
  selector: 'lfx-add-user-dialog',
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent, SelectComponent],
  templateUrl: './add-user-dialog.component.html',
  styleUrl: './add-user-dialog.component.css',
})
export class AddUserDialogComponent {
  private readonly userService = inject(UserService);
  private readonly toastService = inject(ToastService);
  protected readonly dialogService = inject(DialogService);

  public readonly products = input.required<Product[]>();

  protected readonly emailControl = new FormControl('', { nonNullable: true });
  protected readonly nameControl = new FormControl('', { nonNullable: true });
  protected readonly roleControl = new FormControl(UserRole.EDITOR, { nonNullable: true });
  protected readonly productControl = new FormControl('', { nonNullable: true });

  protected readonly error = signal('');

  protected readonly roleOptions: SelectOption[] = [
    { label: 'Super Admin', value: UserRole.SUPER_ADMIN },
    { label: 'Product Admin', value: UserRole.PRODUCT_ADMIN },
    { label: 'Editor', value: UserRole.EDITOR },
  ];

  protected readonly selectedRole = toSignal(this.roleControl.valueChanges, { initialValue: UserRole.EDITOR });
  protected readonly isSuperAdmin: Signal<boolean> = computed(() => this.selectedRole() === UserRole.SUPER_ADMIN);

  protected readonly productOptions: Signal<SelectOption[]> = computed(() => [
    { label: 'Global (all products)', value: '' },
    ...this.products().map((p) => ({ label: p.name, value: p.id })),
  ]);

  protected create(): void {
    const email = this.emailControl.value.trim();
    const name = this.nameControl.value.trim();
    const role = this.roleControl.value;
    if (!email || !name || !role) return;

    this.error.set('');
    const isSuperAdmin = role === UserRole.SUPER_ADMIN;
    const productId = isSuperAdmin ? undefined : this.productControl.value || undefined;

    this.userService.create({ email, name, role, productId }).subscribe({
      next: () => {
        this.toastService.success('User added');
        this.dialogService.close('created');
      },
      error: (err: unknown) => {
        const message = (err as { error?: { error?: string } })?.error?.error;
        this.error.set(message || 'Failed to create user');
      },
    });
  }
}
