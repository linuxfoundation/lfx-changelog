// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { isPlatformBrowser } from '@angular/common';
import { Component, inject, input, PLATFORM_ID, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { DropdownMenuItem } from '@shared/interfaces/form.interface';

export type { DropdownMenuItem };

@Component({
  selector: 'lfx-dropdown-menu',
  imports: [CdkOverlayOrigin, CdkConnectedOverlay, RouterLink],
  templateUrl: './dropdown-menu.component.html',
  styleUrl: './dropdown-menu.component.css',
})
export class DropdownMenuComponent {
  protected readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  public readonly items = input<DropdownMenuItem[]>([]);
  protected readonly isOpen = signal(false);

  protected readonly positions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
  ];

  protected toggle(): void {
    this.isOpen.update((v) => !v);
  }

  protected close(): void {
    this.isOpen.set(false);
  }

  protected onItemClick(item: DropdownMenuItem): void {
    item.action?.();
    this.close();
  }
}
