// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import pino from 'pino';
import pinoPretty from 'pino-pretty';

import { customErrorSerializer } from './helpers/error-serializer';

import type { IncomingMessage, ServerResponse } from 'node:http';

const prettyStream =
  process.env['NODE_ENV'] !== 'production'
    ? pinoPretty({
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      })
    : process.stdout;

/**
 * Lean request serializer — only fields useful for debugging.
 * Excludes all browser fingerprint headers, query/params (already in URL), cookies, etc.
 */
export function reqSerializer(req: IncomingMessage & { originalUrl?: string; ip?: string }) {
  return {
    id: req.id,
    method: req.method,
    url: req.originalUrl || req.url,
    remoteAddress: req.ip || req.socket?.remoteAddress,
    userAgent: req.headers['user-agent'],
  };
}

/**
 * Lean response serializer — statusCode only.
 * Excludes all response headers (set-cookie with session JWT, security headers, etc.)
 */
export function resSerializer(res: ServerResponse) {
  return {
    statusCode: res.statusCode,
  };
}

export const serverLogger = pino(
  {
    level: process.env['LOG_LEVEL'] || 'info',
    base: {
      service: 'lfx-changelog',
      environment: process.env['NODE_ENV'] || 'development',
    },
    serializers: {
      err: customErrorSerializer,
      error: customErrorSerializer,
      req: reqSerializer,
      res: resSerializer,
    },
    formatters: {
      level: (label) => ({ level: label.toUpperCase() }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  prettyStream
);
