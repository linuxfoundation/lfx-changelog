// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import express from 'express';
import helmet from 'helmet';

import { requestIdMiddleware } from '../middleware/request-id.middleware';

import type { Express } from 'express';

// At runtime, esbuild bundles all server code into a single server.mjs,
// so import.meta.dirname always resolves to the bundle's directory (dist/.../server/).
const browserDistFolder = import.meta.dirname + '/../browser';

/**
 * Registers the lowest-level middleware that every request passes through:
 * request ID, security headers, compression, body parsers, and static files.
 */
export function setupGlobalMiddleware(app: Express): void {
  // Request ID — tracing for all downstream middleware + handlers
  app.use(requestIdMiddleware);

  // Helmet — security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Angular SSR manages its own CSP
      crossOriginEmbedderPolicy: false, // Font Awesome kit requires cross-origin loading
    })
  );

  // Compression
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const compression = require('compression');
  app.use(
    compression({
      level: 6,
      threshold: 1024,
    })
  );

  // Body parsers (1mb limit — sufficient for changelog API)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Static files
  app.use(
    express.static(browserDistFolder, {
      maxAge: '1y',
      index: false,
      redirect: false,
    })
  );
}
