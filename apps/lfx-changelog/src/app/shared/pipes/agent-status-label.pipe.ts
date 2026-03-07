// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Pipe, PipeTransform } from '@angular/core';

import type { AgentJobStatus } from '@lfx-changelog/shared';

@Pipe({
  name: 'agentStatusLabel',
  standalone: true,
})
export class AgentStatusLabelPipe implements PipeTransform {
  public transform(status: AgentJobStatus): string {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'running':
        return 'Running';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
    }
  }
}
