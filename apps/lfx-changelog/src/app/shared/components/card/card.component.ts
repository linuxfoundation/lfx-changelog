// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, input } from '@angular/core';

@Component({
  selector: 'lfx-card',
  templateUrl: './card.component.html',
  styleUrl: './card.component.css',
})
export class CardComponent {
  public readonly padding = input<'none' | 'sm' | 'md' | 'lg'>('md');
  public readonly hoverable = input(false);
}
