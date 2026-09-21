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

  /** Set by a dialog running an operation that must not be abandoned halfway. */
  public readonly busy = signal(false);

  public open(config: DialogConfig): void {
    this.busy.set(false);
    this.config.set(config);
    this.lockBodyScroll(true);
  }

  public close(result?: unknown): void {
    const current = this.config();
    this.busy.set(false);
    this.config.set(null);
    this.lockBodyScroll(false);
    current?.onClose?.(result);
  }

  /** Dismissal the user asked for — overlay, close button, Escape. Ignored while busy. */
  public requestClose(result?: unknown): void {
    if (this.busy()) return;
    this.close(result);
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
