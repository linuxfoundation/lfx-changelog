// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { BaseApiError } from './base-api.error';

export class ServiceUnavailableError extends BaseApiError {
  public constructor(
    message = 'Service unavailable',
    options: {
      operation?: string;
      service?: string;
      path?: string;
    } = {}
  ) {
    super(message, 503, 'SERVICE_UNAVAILABLE', options);
  }
}
