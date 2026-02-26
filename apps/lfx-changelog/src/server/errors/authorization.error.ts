// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { BaseApiError } from './base-api.error';

export class AuthorizationError extends BaseApiError {
  public constructor(
    message = 'Insufficient permissions',
    options: {
      operation?: string;
      service?: string;
      path?: string;
    } = {}
  ) {
    super(message, 403, 'AUTHORIZATION_REQUIRED', options);
  }
}
