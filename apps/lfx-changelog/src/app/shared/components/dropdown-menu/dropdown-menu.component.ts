// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, ElementRef, inject, input, OnDestroy, signal } from '@angular/core';

import type { DropdownMenuItem } from '@shared/interfaces/form.interface';

export type { DropdownMenuItem };

@Component({
  selector: 'lfx-dropdown-menu',
  templateUrl: './dropdown-menu.component.html',
  styleUrl: './dropdown-menu.component.css',
  host: {
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class DropdownMenuComponent implements OnDestroy {
  private readonly el = inject(ElementRef);
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private panelEl: HTMLElement | null = null;

  public readonly items = input<DropdownMenuItem[]>([]);
  protected readonly isOpen = signal(false);

  public constructor() {
    this.destroyRef.onDestroy(() => this.removePanel());
  }

  public ngOnDestroy(): void {
    this.removePanel();
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen()) return;
    const target = event.target as HTMLElement;
    if (!this.el.nativeElement.contains(target) && !this.panelEl?.contains(target)) {
      this.close();
    }
  }

  protected toggle(event: Event): void {
    if (this.isOpen()) {
      this.close();
      return;
    }

    const trigger = (event.target as HTMLElement).closest('button, [role="button"]') || (event.target as HTMLElement);
    const rect = trigger.getBoundingClientRect();
    this.createPanel(rect);
    this.isOpen.set(true);
    this.doc.addEventListener('scroll', this.onScroll, true);
  }

  private readonly onScroll = (): void => this.close();

  private close(): void {
    this.doc.removeEventListener('scroll', this.onScroll, true);
    this.isOpen.set(false);
    this.removePanel();
  }

  private createPanel(rect: DOMRect): void {
    this.removePanel();

    const panel = this.doc.createElement('div');
    panel.className = 'animate-select-dropdown-in border-border bg-surface fixed z-50 min-w-[160px] rounded-lg border py-1 shadow-lg';
    panel.style.top = `${rect.bottom + 4}px`;
    panel.style.right = `${this.doc.documentElement.clientWidth - rect.right}px`;

    for (const item of this.items()) {
      const btn = this.doc.createElement('button');
      btn.textContent = item.label;
      btn.className = `hover:bg-surface-alt flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
        item.danger ? 'text-red-500 hover:text-red-600' : 'text-text-primary'
      }`;
      btn.addEventListener('click', () => {
        item.action();
        this.close();
      });
      panel.appendChild(btn);
    }

    this.doc.body.appendChild(panel);
    this.panelEl = panel;
  }

  private removePanel(): void {
    if (this.panelEl) {
      this.panelEl.remove();
      this.panelEl = null;
    }
  }
}
