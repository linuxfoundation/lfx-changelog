// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { randomUUID } from 'node:crypto';

import { NextFunction, Request, Response } from 'express';

/**
 * Generates or forwards a request ID for tracing.
 * Respects incoming `x-request-id` from load balancers / proxies.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string) || randomUUID();
  req.id = id;
  res.setHeader('x-request-id', id);
  next();
}
