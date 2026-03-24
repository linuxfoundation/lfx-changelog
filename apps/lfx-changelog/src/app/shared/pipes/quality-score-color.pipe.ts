// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'qualityScoreColor',
  standalone: true,
})
export class QualityScoreColorPipe implements PipeTransform {
  public transform(overall: number): string {
    if (overall >= 4) return '#22C55E';
    if (overall >= 3) return '#EAB308';
    return '#EF4444';
  }
}
