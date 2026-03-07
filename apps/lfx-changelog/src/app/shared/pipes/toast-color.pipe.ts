// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Pipe, PipeTransform } from '@angular/core';

import type { ToastType } from '@shared/interfaces/toast.interface';

@Pipe({
  name: 'toastColor',
  standalone: true,
})
export class ToastColorPipe implements PipeTransform {
  public transform(type: ToastType): string {
    switch (type) {
      case 'success':
        return 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400';
      case 'error':
        return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400';
      case 'warning':
        return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400';
      case 'info':
        return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400';
    }
  }
}
