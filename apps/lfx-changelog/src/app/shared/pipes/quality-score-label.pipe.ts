// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'qualityScoreLabel',
  standalone: true,
})
export class QualityScoreLabelPipe implements PipeTransform {
  public transform(overall: number): string {
    return `${overall.toFixed(1)}/5`;
  }
}
