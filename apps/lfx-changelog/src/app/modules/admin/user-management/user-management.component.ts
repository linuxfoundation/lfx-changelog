import { Component, computed, inject, signal, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AvatarComponent } from '@components/avatar/avatar.component';
import { BadgeComponent } from '@components/badge/badge.component';
import { ButtonComponent } from '@components/button/button.component';
import { CardComponent } from '@components/card/card.component';
import { DialogComponent } from '@components/dialog/dialog.component';
import { SelectComponent } from '@components/select/select.component';
import type { Product, User } from '@lfx-changelog/shared';
import { UserRole } from '@lfx-changelog/shared';
import { ProductService } from '@services/product/product.service';
import { UserService } from '@services/user/user.service';
import type { SelectOption } from '@shared/interfaces/form.interface';
import { ProductNamePipe } from '@shared/pipes/product-name/product-name.pipe';
import { RoleColorPipe } from '@shared/pipes/role-color/role-color.pipe';
import { RoleLabelPipe } from '@shared/pipes/role-label/role-label.pipe';
import { BehaviorSubject, switchMap, tap } from 'rxjs';

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

  protected readonly newRoleControl = new FormControl('', { nonNullable: true });
  protected readonly newProductControl = new FormControl('', { nonNullable: true });

  protected readonly dialogVisible = signal(false);
  protected readonly selectedUser = signal<User | null>(null);

  protected readonly roleOptions: SelectOption[] = [
    { label: 'Super Admin', value: UserRole.SUPER_ADMIN },
    { label: 'Product Admin', value: UserRole.PRODUCT_ADMIN },
    { label: 'Editor', value: UserRole.EDITOR },
  ];

  protected readonly productOptions: Signal<SelectOption[]> = this.initProductOptions();

  protected openRoleDialog(user: User): void {
    this.selectedUser.set(user);
    this.newRoleControl.setValue('');
    this.newProductControl.setValue('');
    this.dialogVisible.set(true);
  }

  protected assignRole(): void {
    const user = this.selectedUser();
    if (!user || !this.newRoleControl.value) return;

    this.userService.assignRole(user.id, this.newRoleControl.value, this.newProductControl.value || null).subscribe(() => {
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
