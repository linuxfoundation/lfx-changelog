// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, input } from '@angular/core';

@Component({
  selector: 'lfx-skeleton',
  templateUrl: './skeleton.component.html',
  styleUrl: './skeleton.component.css',
})
export class SkeletonComponent {
  public readonly width = input<string>('100%');
  public readonly height = input<string>('1rem');
  public readonly variant = input<'text' | 'circle' | 'rect'>('text');
}
