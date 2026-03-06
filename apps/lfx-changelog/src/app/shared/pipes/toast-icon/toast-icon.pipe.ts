// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Pipe, PipeTransform } from '@angular/core';

import type { ToastType } from '@shared/interfaces/toast.interface';

@Pipe({
  name: 'toastIcon',
  standalone: true,
})
export class ToastIconPipe implements PipeTransform {
  public transform(type: ToastType): string {
    switch (type) {
      case 'success':
        return 'fa-solid fa-circle-check';
      case 'error':
        return 'fa-solid fa-circle-exclamation';
      case 'warning':
        return 'fa-solid fa-triangle-exclamation';
      case 'info':
        return 'fa-solid fa-circle-info';
    }
  }
}
