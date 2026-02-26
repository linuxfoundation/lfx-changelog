// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'firstLine' })
export class FirstLinePipe implements PipeTransform {
  public transform(value: string): string {
    return value.split('\n')[0];
  }
}
