// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { NextFunction, Request, Response } from 'express';

interface CacheOptions {
  maxAge: number;
  staleWhileRevalidate?: number;
}

/**
 * Factory that returns middleware setting Cache-Control headers for public GET responses.
 */
export function cacheMiddleware({ maxAge, staleWhileRevalidate }: CacheOptions) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    let value = `public, max-age=${maxAge}`;
    if (staleWhileRevalidate) {
      value += `, stale-while-revalidate=${staleWhileRevalidate}`;
    }
    res.setHeader('Cache-Control', value);
    next();
  };
}

/**
 * Middleware that prevents caching on protected routes.
 */
export function noCacheMiddleware(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  next();
}

/**
 * Middleware for SSR pages that sets cache headers based on the request path.
 *
 * - Appends `Cookie` to the Vary header so browsers invalidate their cache when auth state
 *   changes (e.g. after login/logout), rather than serving a stale page from cache.
 * - Admin pages (`/admin/*`): `Cache-Control: private, max-age=0` — never cached.
 * - All other pages: `Cache-Control: public, max-age=600` (10 minutes).
 */
export function ssrCacheMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.vary('Cookie');

  if (req.path.startsWith('/admin')) {
    res.setHeader('Cache-Control', 'private, max-age=0');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=600');
  }

  next();
}
