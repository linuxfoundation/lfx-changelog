// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatTokens',
  standalone: true,
})
export class FormatTokensPipe implements PipeTransform {
  public transform(value: number | null): string {
    if (value == null) return '--';
    return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString();
  }
}
