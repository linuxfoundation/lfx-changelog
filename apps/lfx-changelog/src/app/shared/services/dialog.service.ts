// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

import type { Type } from '@angular/core';

export type DialogSize = 'sm' | 'md' | 'lg';

export type DialogConfig = {
  title: string;
  size?: DialogSize;
  component: Type<unknown>;
  inputs?: Record<string, unknown>;
  testId?: string;
  onClose?: (result?: unknown) => void;
};

@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly platformId = inject(PLATFORM_ID);

  public readonly config = signal<DialogConfig | null>(null);
  public readonly visible = computed(() => this.config() !== null);

  public open(config: DialogConfig): void {
    this.config.set(config);
    this.lockBodyScroll(true);
  }

  public close(result?: unknown): void {
    const current = this.config();
    this.config.set(null);
    this.lockBodyScroll(false);
    current?.onClose?.(result);
  }

  public updateTitle(title: string): void {
    const current = this.config();
    if (current) {
      this.config.set({ ...current, title });
    }
  }

  private lockBodyScroll(lock: boolean): void {
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = lock ? 'hidden' : '';
    }
  }
}
