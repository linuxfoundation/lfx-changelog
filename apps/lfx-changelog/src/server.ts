// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import './server/setup/tracer';

import { createNodeRequestHandler, isMainModule } from '@angular/ssr/node';
import dotenv from 'dotenv';
import express from 'express';

import { serverLogger } from './server/server-logger';
import { getOpenSearchService } from './server/services/opensearch.service';
import { setupAuth } from './server/setup/auth';
import { setupCors } from './server/setup/cors';
import { setupGlobalMiddleware } from './server/setup/global-middleware';
import { gracefulShutdown } from './server/setup/graceful-shutdown';
import { setupLogger } from './server/setup/logger';
import { setupRateLimiting } from './server/setup/rate-limit';
import { setupRoutes } from './server/setup/routes';
import { setupSsr } from './server/setup/ssr';

if (process.env['NODE_ENV'] !== 'production') {
  dotenv.config();
}

const app = express();

// Request pipeline (order matters)
setupGlobalMiddleware(app); // Request ID, helmet, compression, body parsers, static files
setupCors(app); // CORS strategies for public API, MCP, and API-key requests
setupRateLimiting(app); // IP-based rate limiting (API-key limiter is in routes, after auth)
setupLogger(app); // Pino HTTP request logging
setupAuth(app); // Auth0 OIDC + login/logout routes
setupRoutes(app); // Health, docs, webhooks, public API, MCP, protected API
getOpenSearchService()
  .ensureIndex()
  .catch((err) => serverLogger.warn({ err }, 'OpenSearch index setup failed — search will be unavailable'));
setupSsr(app); // Angular SSR catch-all + global error handler

export function startServer(): void {
  const port = process.env['PORT'] || 4000;
  const server = app.listen(port, () => {
    serverLogger.info(`Node Express server listening on http://localhost:${port}`);
  });
  gracefulShutdown(server);
}

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  startServer();
}

export const reqHandler = createNodeRequestHandler(app);
