// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { BaseApiError } from './base-api.error';

export class NotFoundError extends BaseApiError {
  public constructor(
    message = 'Resource not found',
    options: {
      operation?: string;
      service?: string;
      path?: string;
    } = {}
  ) {
    super(message, 404, 'NOT_FOUND', options);
  }
}
