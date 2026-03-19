// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'initial' })
export class InitialPipe implements PipeTransform {
  public transform(value: string | null | undefined, fallback = '?'): string {
    return value?.charAt(0)?.toUpperCase() || fallback;
  }
}
