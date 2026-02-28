// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

export { AiServiceError } from './ai.error';
export { AuthenticationError } from './authentication.error';
export { AuthorizationError } from './authorization.error';
export { BaseApiError } from './base-api.error';
export { ConflictError } from './conflict.error';
export { NotFoundError } from './not-found.error';

import { BaseApiError } from './base-api.error';

export function isBaseApiError(error: unknown): error is BaseApiError {
  return error instanceof BaseApiError;
}
