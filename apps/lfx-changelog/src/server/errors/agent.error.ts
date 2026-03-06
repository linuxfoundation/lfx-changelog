// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { BaseApiError } from './base-api.error';

export class AgentServiceError extends BaseApiError {
  public constructor(
    message = 'Changelog agent service request failed',
    options: {
      operation?: string;
      service?: string;
      path?: string;
      metadata?: Record<string, any>;
    } = {}
  ) {
    super(message, 502, 'AGENT_SERVICE_ERROR', {
      service: 'changelog-agent',
      ...options,
    });
  }
}
