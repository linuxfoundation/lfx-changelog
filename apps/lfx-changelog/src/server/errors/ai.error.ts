import { BaseApiError } from './base-api.error';

export class AiServiceError extends BaseApiError {
  public constructor(
    message = 'AI service request failed',
    options: {
      operation?: string;
      service?: string;
      path?: string;
      metadata?: Record<string, any>;
    } = {}
  ) {
    super(message, 502, 'AI_SERVICE_ERROR', {
      service: 'ai',
      ...options,
    });
  }
}
