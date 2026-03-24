// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { Component, computed, input, signal } from '@angular/core';

@Component({
  selector: 'lfx-badge',
  imports: [CdkOverlayOrigin, CdkConnectedOverlay],
  templateUrl: './badge.component.html',
  styleUrl: './badge.component.css',
})
export class BadgeComponent {
  public readonly label = input.required<string>();
  public readonly color = input<string>('#3B82F6');
  public readonly size = input<'sm' | 'md'>('md');
  public readonly hasTooltip = input(false);

  protected readonly isTooltipOpen = signal(false);

  protected readonly positions: ConnectedPosition[] = [
    { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 4 },
    { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -4 },
  ];

  protected readonly bgStyle = computed(() => {
    const hex = this.color();
    return `background-color: ${hex}1a; color: ${hex};`;
  });

  protected showTooltip(): void {
    this.isTooltipOpen.set(true);
  }

  protected hideTooltip(): void {
    this.isTooltipOpen.set(false);
  }
}
