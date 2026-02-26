import { NextFunction, Request, Response } from 'express';

import { BaseApiError, isBaseApiError } from '../errors';
import { serverLogger } from '../server-logger';

export function apiErrorHandler(error: Error | BaseApiError, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (isBaseApiError(error)) {
    const severity = error.getSeverity();
    if (severity === 'error') {
      serverLogger.error({ err: error, path: req.path, method: req.method }, `API error: ${error.message}`);
    } else {
      serverLogger.warn({ err: error, path: req.path, method: req.method }, `API error: ${error.message}`);
    }

    res.status(error.statusCode).json({
      ...error.toResponse(),
      path: req.path,
    });
    return;
  }

  serverLogger.error({ err: error, path: req.path, method: req.method }, 'Unhandled API error');

  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    path: req.path,
  });
}
