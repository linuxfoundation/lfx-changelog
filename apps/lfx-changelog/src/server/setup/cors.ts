// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import cors from 'cors';

import { getCorsOrigins } from '../constants/cors.constants';

import type { Express, NextFunction, Request, Response } from 'express';

/**
 * Registers all CORS strategies:
 * - `/public/api` — allowed origins for external consumers (excluding chat)
 * - `/mcp` — open to all origins (AI clients)
 * - `/api` — conditional CORS for API-key requests (excluding chat)
 */
export function setupCors(app: Express): void {
  // Widget-consumed routes — open CORS for embeddable widget on any origin
  const widgetCors = cors({ origin: '*', methods: ['GET', 'HEAD', 'OPTIONS'], maxAge: 86400 });
  app.use('/public/api/changelogs', widgetCors);
  app.use('/public/api/products', widgetCors);

  // Remaining public API routes (search, blogs, chat, etc.) — restricted to app origin
  app.use('/public/api', (req: Request, res: Response, next: NextFunction) => {
    // Skip paths already handled by widgetCors above to avoid double-applying
    if (req.path.startsWith('/changelogs') || req.path.startsWith('/products')) {
      next();
      return;
    }
    cors({
      origin: getCorsOrigins(),
      methods: ['GET', 'HEAD', 'OPTIONS'],
      maxAge: 86400,
    })(req, res, next);
  });

  // MCP endpoint — AI clients need cross-origin access
  app.use(
    '/mcp',
    cors({
      origin: '*',
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      maxAge: 86400,
    })
  );

  // Protected API when accessed via API key (programmatic clients)
  // Chat routes are excluded — they're same-origin only
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/chat')) {
      next();
      return;
    }

    const hasApiKey =
      req.headers['authorization']?.startsWith('Bearer lfx_') || (typeof req.headers['x-api-key'] === 'string' && req.headers['x-api-key'].startsWith('lfx_'));

    // Preflight (OPTIONS) requests don't carry the actual Authorization header —
    // they only list it in Access-Control-Request-Headers. Match those too.
    const isPreflight = req.method === 'OPTIONS' && /\b(authorization|x-api-key)\b/i.test(req.headers['access-control-request-headers'] || '');

    if (hasApiKey || isPreflight) {
      cors({
        origin: getCorsOrigins(),
        credentials: false,
        methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
        maxAge: 86400,
      })(req, res, next);
      return;
    }
    next();
  });
}
