// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import type { Express, Request } from 'express';

/**
 * Creates the API-key rate limiter instance (1000 req/hour per key).
 * Exported so `setupRoutes` can register it after `hybridAuthMiddleware`,
 * which is required because the limiter reads `req.authMethod` and `req.apiKey`.
 */
export function createApiKeyRateLimiter() {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 1000,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => (req as Request).apiKey!.id,
    message: { error: 'API key rate limit exceeded. Maximum 1000 requests per hour.' },
  });
}

/**
 * Registers rate limiters (skipped when SKIP_RATE_LIMIT=true):
 * - IP-based: 100 req/min on `/public/api`, `/api`, `/mcp`
 *
 * Note: The API-key rate limiter is registered separately in `setupRoutes`
 * because it must run after `hybridAuthMiddleware` sets `req.authMethod`.
 */
export function setupRateLimiting(app: Express): void {
  if (process.env['SKIP_RATE_LIMIT'] === 'true') {
    return;
  }

  // IP-based limiter — 100 req/min
  const apiRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => {
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
      return ipKeyGenerator(ip);
    },
    message: { error: 'Too many requests, please try again later.' },
  });
  app.use('/public/api', apiRateLimiter);
  app.use('/api', apiRateLimiter);
  app.use('/mcp', apiRateLimiter);
}
