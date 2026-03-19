// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, DestroyRef, inject, input, signal, Signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '@components/button/button.component';
import { CardComponent } from '@components/card/card.component';
import { SelectComponent } from '@components/select/select.component';
import { InitialPipe } from '@pipes/initial.pipe';
import { ProductService } from '@services/product.service';
import { ToastService } from '@services/toast.service';
import { UserService } from '@services/user.service';
import { catchError, map, merge, of, startWith, Subject, switchMap } from 'rxjs';

import type { ProductSlackNotifyUser } from '@lfx-changelog/shared';
import type { LoadingState } from '@shared/interfaces/loading-state.interface';

@Component({
  selector: 'lfx-product-notifications-tab',
  imports: [ButtonComponent, CardComponent, SelectComponent, ReactiveFormsModule, InitialPipe],
  templateUrl: './product-notifications-tab.component.html',
  styleUrl: './product-notifications-tab.component.css',
})
export class ProductNotificationsTabComponent {
  private readonly productService = inject(ProductService);
  private readonly userService = inject(UserService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  public readonly productId = input.required<string>();

  protected readonly userControl = new FormControl('', { nonNullable: true });

  protected readonly adding = signal(false);
  protected readonly removingId = signal<string | null>(null);

  private readonly refresh$ = new Subject<void>();

  private readonly notifyUsersState: Signal<LoadingState<ProductSlackNotifyUser[]>> = this.initNotifyUsersState();
  protected readonly notifyUsers = computed(() => this.notifyUsersState().data);
  protected readonly loading = computed(() => this.notifyUsersState().loading);

  private readonly allUsers = toSignal(this.userService.getAll(), { initialValue: [] });

  protected readonly userOptions = computed(() => {
    const existing = new Set(this.notifyUsers().map((n) => n.userId));
    return this.allUsers()
      .filter((u) => !existing.has(u.id))
      .map((u) => ({ label: `${u.name} (${u.email})`, value: u.id }));
  });

  protected addUser(): void {
    const userId = this.userControl.value;
    if (!userId) return;

    this.adding.set(true);
    this.productService
      .addNotifyUser(this.productId(), { userId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.userControl.reset('');
          this.adding.set(false);
          this.refresh$.next();
          this.toastService.success('User added to notifications.');
        },
        error: () => {
          this.adding.set(false);
          this.toastService.error('Failed to add user.');
        },
      });
  }

  protected removeUser(userId: string): void {
    this.removingId.set(userId);
    this.productService
      .removeNotifyUser(this.productId(), userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.removingId.set(null);
          this.refresh$.next();
          this.toastService.success('User removed from notifications.');
        },
        error: () => {
          this.removingId.set(null);
          this.toastService.error('Failed to remove user.');
        },
      });
  }

  private initNotifyUsersState(): Signal<LoadingState<ProductSlackNotifyUser[]>> {
    return toSignal(
      merge(toObservable(this.productId), this.refresh$).pipe(
        switchMap(() =>
          this.productService.getNotifyUsers(this.productId()).pipe(
            map((data) => ({ data, loading: false })),
            catchError(() => of({ data: [] as ProductSlackNotifyUser[], loading: false })),
            startWith({ data: [] as ProductSlackNotifyUser[], loading: true })
          )
        )
      ),
      { initialValue: { data: [], loading: true } }
    );
  }
}
