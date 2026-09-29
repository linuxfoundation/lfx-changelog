// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '@components/button/button.component';
import { InputComponent } from '@components/input/input.component';
import { DialogService } from '@services/dialog.service';
import { ToastService } from '@services/toast.service';
import { UserService } from '@services/user.service';
import { apiErrorMessage } from '@shared/utils/api-error-message';

import type { UpdateUserRequest, User } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-edit-user-dialog',
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent],
  templateUrl: './edit-user-dialog.component.html',
  styleUrl: './edit-user-dialog.component.css',
})
export class EditUserDialogComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly toastService = inject(ToastService);
  protected readonly dialogService = inject(DialogService);

  public readonly user = input.required<User>();
  public readonly isSelf = input(false);

  protected readonly nameControl = new FormControl('', { nonNullable: true });
  protected readonly emailControl = new FormControl('', { nonNullable: true });

  protected readonly error = signal('');
  protected readonly saving = signal(false);

  public ngOnInit(): void {
    this.nameControl.setValue(this.user().name);
    this.emailControl.setValue(this.user().email);
    if (this.isSelf()) this.emailControl.disable();
  }

  protected save(): void {
    const name = this.nameControl.value.trim();
    const email = this.emailControl.value.trim();
    if (!name || !email) {
      this.error.set('Name and email are required.');
      return;
    }

    const changes: UpdateUserRequest = {};
    if (name !== this.user().name) changes.name = name;
    if (email !== this.user().email) changes.email = email;
    if (!changes.name && !changes.email) {
      this.dialogService.close();
      return;
    }

    this.error.set('');
    this.saving.set(true);
    this.userService.update(this.user().id, changes).subscribe({
      next: () => {
        this.toastService.success('User updated');
        this.dialogService.close('updated');
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(err, 'Failed to update user'));
      },
    });
  }
}
