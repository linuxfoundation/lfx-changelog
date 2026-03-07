// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { NgComponentOutlet } from '@angular/common';
import { Component, computed, HostListener, inject } from '@angular/core';
import { DialogService } from '@services/dialog.service';

@Component({
  selector: 'lfx-dialog-outlet',
  imports: [NgComponentOutlet],
  templateUrl: './dialog-outlet.component.html',
  styleUrl: './dialog-outlet.component.css',
})
export class DialogOutletComponent {
  protected readonly dialogService = inject(DialogService);

  protected readonly sizeClass = computed(() => {
    const size = this.dialogService.config()?.size ?? 'md';
    switch (size) {
      case 'sm':
        return 'w-full max-w-sm';
      case 'lg':
        return 'w-full max-w-2xl';
      default:
        return 'w-full max-w-lg';
    }
  });

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.dialogService.visible()) {
      this.dialogService.close();
    }
  }
}
