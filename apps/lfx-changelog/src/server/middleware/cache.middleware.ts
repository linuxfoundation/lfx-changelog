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
