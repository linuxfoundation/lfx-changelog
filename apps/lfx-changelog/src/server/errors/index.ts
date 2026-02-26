export { AuthenticationError } from './authentication.error';
export { AuthorizationError } from './authorization.error';
export { BaseApiError } from './base-api.error';
export { NotFoundError } from './not-found.error';

import { BaseApiError } from './base-api.error';

export function isBaseApiError(error: unknown): error is BaseApiError {
  return error instanceof BaseApiError;
}
