// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { BaseApiError } from './base-api.error';

export class ConflictError extends BaseApiError {
  public constructor(
    message = 'Resource already exists',
    options: {
      operation?: string;
      service?: string;
      path?: string;
    } = {}
  ) {
    super(message, 409, 'CONFLICT', options);
  }
}
