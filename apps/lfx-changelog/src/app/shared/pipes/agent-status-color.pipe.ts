// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Pipe, PipeTransform } from '@angular/core';

import type { AgentJobStatus } from '@lfx-changelog/shared';

@Pipe({
  name: 'agentStatusColor',
  standalone: true,
})
export class AgentStatusColorPipe implements PipeTransform {
  public transform(status: AgentJobStatus): string {
    switch (status) {
      case 'pending':
        return '#F59E0B';
      case 'running':
        return '#3B82F6';
      case 'completed':
        return '#22C55E';
      case 'failed':
        return '#EF4444';
      case 'cancelled':
        return '#F97316';
    }
  }
}
