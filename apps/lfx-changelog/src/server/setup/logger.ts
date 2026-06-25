// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import pinoHttp from 'pino-http';

import { reqSerializer, resSerializer, serverLogger } from '../server-logger';
import { context, trace } from './tracer';

import type { Express, Request } from 'express';
import type { IncomingMessage, ServerResponse } from 'node:http';

export function setupLogger(app: Express): void {
  app.use(
    pinoHttp({
      logger: serverLogger,
      genReqId: (req) => (req as Request).id,
      serializers: {
        req: reqSerializer,
        res: resSerializer,
      },
      mixin: () => {
        try {
          const span = trace.getSpan(context.active());
          if (span) {
            const ctx = span.spanContext();
            return {
              trace_id: ctx.traceId,
              span_id: ctx.spanId,
              trace_flags: ctx.traceFlags.toString(16).padStart(2, '0'),
            };
          }
        } catch {
          // Degrade gracefully when no active span.
        }
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
