import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MOCK_PRODUCTS, MOCK_USERS, UserRole } from '@lfx-changelog/shared';
import type { User } from '@lfx-changelog/shared';
import type { SelectOption } from '@shared/interfaces/form.interface';
import { ProductNamePipe } from '@shared/pipes/product-name/product-name.pipe';
import { RoleColorPipe } from '@shared/pipes/role-color/role-color.pipe';
import { RoleLabelPipe } from '@shared/pipes/role-label/role-label.pipe';
import { AvatarComponent } from '@components/avatar/avatar.component';
import { BadgeComponent } from '@components/badge/badge.component';
import { ButtonComponent } from '@components/button/button.component';
import { CardComponent } from '@components/card/card.component';
import { DialogComponent } from '@components/dialog/dialog.component';
import { SelectComponent } from '@components/select/select.component';

@Component({
  selector: 'lfx-user-management',
  imports: [
    ReactiveFormsModule,
    AvatarComponent,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    DialogComponent,
    SelectComponent,
    ProductNamePipe,
    RoleColorPipe,
    RoleLabelPipe,
  ],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.css',
})
export class UserManagementComponent {
  protected readonly users = MOCK_USERS;

  protected readonly newRoleControl = new FormControl('', { nonNullable: true });
  protected readonly newProductControl = new FormControl('', { nonNullable: true });

  protected readonly dialogVisible = signal(false);
  protected readonly selectedUser = signal<User | null>(null);

  protected readonly roleOptions: SelectOption[] = [
    { label: 'Super Admin', value: UserRole.SUPER_ADMIN },
    { label: 'Product Admin', value: UserRole.PRODUCT_ADMIN },
    { label: 'Editor', value: UserRole.EDITOR },
  ];

  protected readonly productOptions: SelectOption[] = [
    { label: 'Global (all products)', value: '' },
    ...MOCK_PRODUCTS.map((p) => ({ label: p.name, value: p.id })),
  ];

  protected openRoleDialog(user: User): void {
    this.selectedUser.set(user);
    this.newRoleControl.setValue('');
    this.newProductControl.setValue('');
    this.dialogVisible.set(true);
  }
}
