// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'setIncludes',
})
export class SetIncludesPipe implements PipeTransform {
  public transform(set: Set<string>, value: string): boolean {
    return set.has(value);
  }
}
