// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Pipe, PipeTransform } from '@angular/core';

import type { ApiKey } from '@lfx-changelog/shared';

@Pipe({
  name: 'keyStatus',
})
export class KeyStatusPipe implements PipeTransform {
  public transform(key: ApiKey): 'active' | 'expired' | 'revoked' {
    if (key.revokedAt) return 'revoked';
    if (new Date(key.expiresAt) <= new Date()) return 'expired';
    return 'active';
  }
}
