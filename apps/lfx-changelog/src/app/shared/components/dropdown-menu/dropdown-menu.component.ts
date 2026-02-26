// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, input, signal } from '@angular/core';
import type { DropdownMenuItem } from '@shared/interfaces/form.interface';

export type { DropdownMenuItem };

@Component({
  selector: 'lfx-dropdown-menu',
  templateUrl: './dropdown-menu.component.html',
  styleUrl: './dropdown-menu.component.css',
})
export class DropdownMenuComponent {
  public readonly items = input<DropdownMenuItem[]>([]);
  protected readonly isOpen = signal(false);

  protected toggle(): void {
    this.isOpen.update((v) => !v);
  }

  protected selectItem(item: DropdownMenuItem): void {
    item.action();
    this.isOpen.set(false);
  }
}
