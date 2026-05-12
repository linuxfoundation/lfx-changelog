// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import pinoHttp from 'pino-http';

import { reqSerializer, resSerializer, serverLogger } from '../server-logger';

import type { Express, Request } from 'express';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Registers the Pino HTTP logger with custom serializers to avoid leaking
 * sessions/headers. Silences health-probe and static-asset noise.
 *
 * dd-trace injects trace context (dd.trace_id, dd.span_id) into the pino
 * logger's context when logInjection is enabled. The serializers below
 * preserve those injected fields by avoiding any transformation of the
 * root log object — they only define how to serialize the req/res fields.
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
      // Mixin to preserve dd-trace injected fields in every HTTP log
      mixin: () => {
        return {};
      },
      customSuccessMessage: (req: IncomingMessage, res: ServerResponse, responseTime: number) => {
        const method = req.method ?? 'UNKNOWN';
        const url = (req as Request).originalUrl || req.url || '/';
        return `${method} ${url} ${res.statusCode} ${Math.round(responseTime)}ms`;
      },
      customErrorMessage: (req: IncomingMessage, res: ServerResponse, error: Error) => {
        const method = req.method ?? 'UNKNOWN';
        const url = (req as Request).originalUrl || req.url || '/';
        return `${method} ${url} ${res.statusCode} - ${error.message}`;
      },
      autoLogging: {
        ignore: (req) => {
          const url = (req as Request).originalUrl || (req as Request).url;
          return url === '/health' || url === '/livez' || url === '/readyz' || url.startsWith('/assets');
        },
      },
    })
  );
}
