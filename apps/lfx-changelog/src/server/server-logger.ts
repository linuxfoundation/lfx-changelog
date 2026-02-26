import pino from 'pino';
import pinoPretty from 'pino-pretty';

import { customErrorSerializer } from './helpers/error-serializer';

const prettyStream =
  process.env['NODE_ENV'] !== 'production'
    ? pinoPretty({
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      })
    : process.stdout;

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
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
    redact: {
      paths: ['access_token', 'refresh_token', 'authorization', 'cookie', 'req.headers.authorization', 'req.headers.cookie'],
      remove: true,
    },
    formatters: {
      level: (label) => ({ level: label.toUpperCase() }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  prettyStream
);
