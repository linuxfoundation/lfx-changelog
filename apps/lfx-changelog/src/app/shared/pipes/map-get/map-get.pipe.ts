// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Pipe, type PipeTransform } from '@angular/core';

@Pipe({ name: 'mapGet' })
export class MapGetPipe implements PipeTransform {
  public transform(map: Map<string, boolean>, key: string): boolean {
    return map.get(key) ?? false;
  }
}
