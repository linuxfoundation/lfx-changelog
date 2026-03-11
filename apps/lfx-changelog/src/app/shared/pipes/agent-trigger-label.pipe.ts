// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Pipe, PipeTransform } from '@angular/core';

import type { AgentJobTrigger } from '@lfx-changelog/shared';

@Pipe({
  name: 'agentTriggerLabel',
  standalone: true,
})
export class AgentTriggerLabelPipe implements PipeTransform {
  public transform(trigger: AgentJobTrigger): string {
    switch (trigger) {
      case 'webhook_push':
        return 'Push';
      case 'webhook_release':
        return 'Release';
      case 'webhook_pull_request':
        return 'Pull Request';
      case 'manual':
        return 'Manual';
      case 'newsletter_monthly':
        return 'Monthly Newsletter';
      case 'newsletter_product':
        return 'Product Newsletter';
      case 'newsletter_manual':
        return 'Manual Newsletter';
    }
  }
}
