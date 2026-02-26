// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, computed, input } from '@angular/core';
import { BadgeComponent } from '@components/badge/badge.component';
import { ChangelogStatus } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-status-badge',
  imports: [BadgeComponent],
  templateUrl: './status-badge.component.html',
  styleUrl: './status-badge.component.css',
})
export class StatusBadgeComponent {
  public readonly status = input.required<ChangelogStatus>();

  protected readonly label = computed(() => (this.status() === ChangelogStatus.DRAFT ? 'Draft' : 'Published'));

  protected readonly color = computed(() => (this.status() === ChangelogStatus.DRAFT ? '#F59E0B' : '#22C55E'));
}
