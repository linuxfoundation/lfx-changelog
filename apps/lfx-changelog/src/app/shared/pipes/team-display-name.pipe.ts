// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Pipe } from '@angular/core';
import { ROADMAP_TEAM_DISPLAY_NAMES } from '@lfx-changelog/shared';

import type { PipeTransform } from '@angular/core';

@Pipe({ name: 'teamDisplayName' })
export class TeamDisplayNamePipe implements PipeTransform {
  public transform(value: string): string {
    return ROADMAP_TEAM_DISPLAY_NAMES[value] ?? value;
  }
}
