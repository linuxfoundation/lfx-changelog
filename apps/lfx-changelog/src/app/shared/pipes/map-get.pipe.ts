// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Pipe, type PipeTransform } from '@angular/core';

@Pipe({ name: 'mapGet' })
export class MapGetPipe implements PipeTransform {
  public transform<V>(map: Map<string, V>, key: string, fallback?: V): V | undefined {
    return map.get(key) ?? fallback;
  }
}
