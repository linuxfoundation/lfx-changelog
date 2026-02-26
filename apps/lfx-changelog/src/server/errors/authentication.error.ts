// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { BaseApiError } from './base-api.error';

export class AuthenticationError extends BaseApiError {
  public constructor(
    message = 'Authentication required',
    options: {
      operation?: string;
      service?: string;
      path?: string;
    } = {}
  ) {
    super(message, 401, 'AUTHENTICATION_REQUIRED', options);
  }
}
