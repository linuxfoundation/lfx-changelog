// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Pipe, PipeTransform } from '@angular/core';

import type { ProgressLogEntry } from '@lfx-changelog/shared';

@Pipe({
  name: 'progressLogIcon',
  standalone: true,
})
export class ProgressLogIconPipe implements PipeTransform {
  public transform(type: ProgressLogEntry['type']): string {
    switch (type) {
      case 'tool_call':
        return 'fa-duotone fa-wrench';
      case 'tool_result':
        return 'fa-duotone fa-check';
      case 'text':
        return 'fa-duotone fa-message';
      case 'error':
        return 'fa-duotone fa-triangle-exclamation';
    }
  }
}
