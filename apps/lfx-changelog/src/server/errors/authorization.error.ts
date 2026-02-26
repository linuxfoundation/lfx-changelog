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
