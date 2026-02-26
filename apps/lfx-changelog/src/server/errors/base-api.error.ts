// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

export abstract class BaseApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly operation?: string;
  public readonly service?: string;
  public readonly path?: string;
  public readonly metadata?: Record<string, any>;

  public constructor(
    message: string,
    statusCode: number,
    code: string,
    options: {
      operation?: string;
      service?: string;
      path?: string;
      metadata?: Record<string, any>;
    } = {}
  ) {
    super(message);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.operation = options.operation;
    this.service = options.service;
    this.path = options.path;
    this.metadata = options.metadata;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  public getSeverity(): 'error' | 'warn' | 'info' {
    if (this.statusCode >= 500) {
      return 'error';
    }
    if (this.statusCode >= 400) {
      return 'warn';
    }
    return 'info';
  }

  public getLogContext(): Record<string, any> {
    return {
      error_type: this.name,
      error_code: this.code,
      status_code: this.statusCode,
      operation: this.operation,
      service: this.service,
      path: this.path,
      metadata: this.metadata,
    };
  }

  public toResponse(): Record<string, any> {
    return {
      error: this.message,
      code: this.code,
      ...(this.service && { service: this.service }),
      ...(this.metadata && { metadata: this.metadata }),
    };
  }
}
