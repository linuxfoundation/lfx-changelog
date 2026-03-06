// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

import type { Toast, ToastType } from '@shared/interfaces/toast.interface';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private nextId = 0;

  public readonly toasts = signal<Toast[]>([]);

  public success(message: string): void {
    this.show('success', message);
  }

  public error(message: string): void {
    this.show('error', message);
  }

  public warning(message: string): void {
    this.show('warning', message);
  }

  public info(message: string): void {
    this.show('info', message);
  }

  public dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private show(type: ToastType, message: string): void {
    const id = this.nextId++;
    this.toasts.update((list) => [...list, { id, type, message }]);

    if (isPlatformBrowser(this.platformId)) {
      const timer = setTimeout(() => {
        this.timers.delete(id);
        this.toasts.update((list) => list.filter((t) => t.id !== id));
      }, 4000);
      this.timers.set(id, timer);
    }
  }
}
