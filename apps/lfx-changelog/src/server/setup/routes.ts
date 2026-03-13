// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { hybridAuthMiddleware } from '../middleware/api-key-auth.middleware';
import { noCacheMiddleware } from '../middleware/cache.middleware';
import { apiErrorHandler } from '../middleware/error-handler.middleware';
import { sameOriginOnly } from '../middleware/same-origin.middleware';
import agentJobRouter from '../routes/agent-job.route';
import aiRouter from '../routes/ai.route';
import apiKeyRouter from '../routes/api-key.route';
import blogRouter from '../routes/blog.route';
import changelogRouter from '../routes/changelog.route';
import chatRouter from '../routes/chat.route';
import githubRouter, { releaseRouter } from '../routes/github.route';
import mcpRouter from '../routes/mcp.route';
import opensearchRouter from '../routes/opensearch.route';
import productRouter from '../routes/product.route';
import publicBlogRouter from '../routes/public-blog.route';
import publicChangelogRouter from '../routes/public-changelog.route';
import publicChatRouter from '../routes/public-chat.route';
import publicProductRouter from '../routes/public-product.route';
import publicSearchRouter from '../routes/public-search.route';
import slackRouter from '../routes/slack.route';
import userRouter from '../routes/user.route';
import webhookRouter from '../routes/webhook.route';
import { SearchService } from '../services/search.service';
import { setupSwagger } from '../swagger';
import { createApiKeyRateLimiter, createAuthenticatedChatRateLimiter, createPublicChatRateLimiter } from './rate-limit';

import type { Express, NextFunction, Request, Response } from 'express';

/**
 * Registers all route handlers in order:
 * health check, swagger, webhooks, public API, MCP, protected API pipeline, and error handlers.
 */
export function setupRoutes(app: Express): void {
  // ── Health check ──────────────────────────────────────────────────────
  app.get('/health', async (_req: Request, res: Response) => {
    let opensearchStatus: 'connected' | 'unavailable' | 'not_configured' = 'not_configured';
    if (process.env['OPENSEARCH_URL']) {
      const opensearchUp = await Promise.race([new SearchService().ping(), new Promise<false>((resolve) => setTimeout(() => resolve(false), 1_000))]);
      opensearchStatus = opensearchUp ? 'connected' : 'unavailable';
    }
    res.json({
      status: 'OK',
      services: {
        opensearch: opensearchStatus,
      },
    });
  });

  // ── API documentation ─────────────────────────────────────────────────
  app.use('/docs', setupSwagger());

  // ── Webhook routes (unauthenticated — GitHub App callback) ────────────
  app.use('/webhooks', webhookRouter);

  // ── Public API routes (no auth required) ──────────────────────────────
  if (process.env['SKIP_RATE_LIMIT'] !== 'true') {
    app.use('/public/api/chat', createPublicChatRateLimiter());
  }
  app.use('/public/api/chat', sameOriginOnly, publicChatRouter);
  app.use('/public/api/blog', publicBlogRouter);
  app.use('/public/api/search', publicSearchRouter);
  app.use('/public/api/changelogs', publicChangelogRouter);
  app.use('/public/api/products', publicProductRouter);

  // ── MCP (Model Context Protocol) — public, stateless HTTP transport ───
  app.use('/mcp', mcpRouter);

  // ── Protected API pipeline ────────────────────────────────────────────
  app.use('/api', noCacheMiddleware);
  app.use('/api', hybridAuthMiddleware);

  // API key rate limiter — 1000 req/hour per key (must be after hybridAuthMiddleware)
  if (process.env['SKIP_RATE_LIMIT'] !== 'true') {
    const apiKeyRateLimiter = createApiKeyRateLimiter();
    app.use('/api', (req: Request, res: Response, next: NextFunction) => {
      if (req.authMethod === 'api_key') {
        apiKeyRateLimiter(req, res, next);
        return;
      }
      next();
    });
  }

  // ── Protected API routes ──────────────────────────────────────────────
  app.use('/api/agent-jobs', agentJobRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/blogs', blogRouter);

  // Chat is UI-only — same-origin + session auth only (no API key, no cross-origin)
  if (process.env['SKIP_RATE_LIMIT'] !== 'true') {
    app.use('/api/chat', createAuthenticatedChatRateLimiter());
  }
  app.use('/api/chat', sameOriginOnly, (req: Request, res: Response, next: NextFunction) => {
    if (req.authMethod === 'api_key') {
      res.status(403).json({ success: false, error: 'Chat endpoints require session authentication' });
      return;
    }
    next();
  });
  app.use('/api/chat', chatRouter);
  app.use('/api/api-keys', apiKeyRouter);
  app.use('/api/products', productRouter);
  app.use('/api/changelogs', changelogRouter);
  app.use('/api/users', userRouter);
  app.use('/api/github', githubRouter);
  app.use('/api/opensearch', opensearchRouter);
  app.use('/api/releases', releaseRouter);
  app.use('/api/slack', slackRouter);

  // ── API error handlers ────────────────────────────────────────────────
  app.use('/api', apiErrorHandler);
  app.use('/public/api', apiErrorHandler);
}
