// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import type { Express, Request, RequestHandler } from 'express';

/** Extracts the client IP from X-Forwarded-For or falls back to req.ip. */
function getClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
}

/**
 * Creates the API-key rate limiter instance (1000 req/hour per key).
 * Exported so `setupRoutes` can register it after `hybridAuthMiddleware`,
 * which is required because the limiter reads `req.authMethod` and `req.apiKey`.
 */
export function createApiKeyRateLimiter(): RequestHandler {
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
 * Creates chat-specific rate limiters for anonymous and authenticated users.
 * Chat is far more expensive than CRUD (LLM tokens + tool calls), so it gets
 * tighter limits than the general API.
 */
export function createPublicChatRateLimiter(): RequestHandler {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 3,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(getClientIp(req as Request)),
    message: { error: 'Too many chat requests. Please wait a moment before trying again.' },
  });
}

export function createAuthenticatedChatRateLimiter(): RequestHandler {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 15,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => (req as Request).dbUser?.id ?? ipKeyGenerator(getClientIp(req as Request)),
    message: { error: 'Too many chat requests. Please wait a moment before trying again.' },
  });
}

/**
 * Registers rate limiters (skipped when SKIP_RATE_LIMIT=true for E2E tests):
 * - IP-based: 100 req/min on `/public/api`, `/api`, `/mcp`
 *
 * Note: Chat-specific and API-key rate limiters are registered separately
 * in `setupRoutes` because they need route-specific context.
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
    keyGenerator: (req) => ipKeyGenerator(getClientIp(req as Request)),
    message: { error: 'Too many requests, please try again later.' },
  });
  app.use('/public/api', apiRateLimiter);
  app.use('/api', apiRateLimiter);
  app.use('/mcp', apiRateLimiter);
}
