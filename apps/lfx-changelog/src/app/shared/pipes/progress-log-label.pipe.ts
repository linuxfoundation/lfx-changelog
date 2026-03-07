// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Pipe, PipeTransform } from '@angular/core';

import type { ProgressLogEntry } from '@lfx-changelog/shared';

@Pipe({
  name: 'progressLogLabel',
  standalone: true,
})
export class ProgressLogLabelPipe implements PipeTransform {
  public transform(type: ProgressLogEntry['type']): string {
    switch (type) {
      case 'tool_call':
        return 'Tool Call';
      case 'tool_result':
        return 'Tool Result';
      case 'text':
        return 'Response';
      case 'error':
        return 'Error';
    }
  }
}
