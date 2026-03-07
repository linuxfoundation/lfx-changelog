// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Pipe, PipeTransform } from '@angular/core';
import { API_KEY_SCOPES } from '@lfx-changelog/shared';

import type { ApiKeyScope } from '@lfx-changelog/shared';

const SCOPE_COLOR_MAP = new Map(API_KEY_SCOPES.map((s) => [s.scope, s.color]));

@Pipe({
  name: 'scopeColor',
})
export class ScopeColorPipe implements PipeTransform {
  public transform(scope: string): string {
    return SCOPE_COLOR_MAP.get(scope as ApiKeyScope) || '#6B7280';
  }
}
