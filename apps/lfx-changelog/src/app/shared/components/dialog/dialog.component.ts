// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, input, model } from '@angular/core';

@Component({
  selector: 'lfx-dialog',
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.css',
})
export class DialogComponent {
  public readonly visible = model(false);
  public readonly title = input<string>('');
  public readonly size = input<'sm' | 'md' | 'lg'>('md');

  protected close(): void {
    this.visible.set(false);
  }
}
