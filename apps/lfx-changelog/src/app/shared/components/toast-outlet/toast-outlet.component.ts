// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { NgClass } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ToastService } from '@services/toast.service';
import { ToastColorPipe } from '@shared/pipes/toast-color.pipe';
import { ToastIconPipe } from '@shared/pipes/toast-icon.pipe';

@Component({
  selector: 'lfx-toast-outlet',
  imports: [NgClass, ToastColorPipe, ToastIconPipe],
  templateUrl: './toast-outlet.component.html',
  styleUrl: './toast-outlet.component.css',
})
export class ToastOutletComponent {
  protected readonly toastService = inject(ToastService);
}
