// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import pinoHttp from 'pino-http';

import { reqSerializer, resSerializer, serverLogger } from '../server-logger';

import type { Express, Request } from 'express';

/**
 * Registers the Pino HTTP logger with custom serializers to avoid leaking
 * sessions/headers. Silences `/health` and `/assets` noise.
 */
export function setupLogger(app: Express): void {
  app.use(
    pinoHttp({
      logger: serverLogger,
      genReqId: (req) => (req as Request).id,
      serializers: {
        req: reqSerializer,
        res: resSerializer,
      },
      autoLogging: {
        ignore: (req) => {
          const url = (req as Request).originalUrl || (req as Request).url;
          return url === '/health' || url.startsWith('/assets');
        },
      },
    })
  );
}
