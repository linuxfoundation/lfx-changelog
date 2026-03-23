// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Component, input, output } from '@angular/core';
import { TeamDisplayNamePipe } from '@shared/pipes/team-display-name.pipe';

import type { RoadmapIdea } from '@lfx-changelog/shared';

@Component({
  selector: 'lfx-roadmap-card',
  imports: [TeamDisplayNamePipe],
  templateUrl: './roadmap-card.component.html',
  styleUrl: './roadmap-card.component.css',
})
export class RoadmapCardComponent {
  public readonly idea = input.required<RoadmapIdea>();
  public readonly cardClick = output<string>();
}
