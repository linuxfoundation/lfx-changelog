// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, input } from '@angular/core';

@Component({
  selector: 'lfx-timeline-item',
  templateUrl: './timeline-item.component.html',
  styleUrl: './timeline-item.component.css',
})
export class TimelineItemComponent {
  public readonly date = input<string>('');
  public readonly index = input(0);
}
