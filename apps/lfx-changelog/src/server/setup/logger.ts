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
 * The mixin injects active dd-trace span context (dd.trace_id, dd.span_id,
 * dd.service) into every HTTP log line so Datadog can correlate logs with
 * APM traces. Falls back to an empty object when dd-trace is unavailable
 * (e.g. local development).
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
      mixin: () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const tracer = require('dd-trace');
          const span = tracer.scope().active();
          if (span) {
            const context = span.context();
            return {
              'dd.trace_id': context.toTraceId(),
              'dd.span_id': context.toSpanId(),
              'dd.service': 'lfx-changelog',
            };
          }
        } catch {
          // dd-trace not available outside production
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
