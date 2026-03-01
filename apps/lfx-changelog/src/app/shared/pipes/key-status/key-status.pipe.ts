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
    if (key.expiresAt <= new Date().toISOString()) return 'expired';
    return 'active';
  }
}
