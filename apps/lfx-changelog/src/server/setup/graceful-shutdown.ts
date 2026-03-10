// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { serverLogger } from '../server-logger';
import { disconnectPrisma } from '../services/prisma.service';
import { SearchService } from '../services/search.service';

import type { Server } from 'node:http';

/**
 * Registers SIGTERM/SIGINT handlers for graceful HTTP + Prisma shutdown.
 */
export function gracefulShutdown(server: Server): void {
  const shutdown = (signal: string) => {
    serverLogger.info(`${signal} received — shutting down gracefully`);

    // Safety net: force exit after 10s
    const forceTimer = setTimeout(() => {
      serverLogger.error('Forced shutdown after 10s timeout');
      process.exit(1);
    }, 10_000);
    forceTimer.unref();

    server.close(async () => {
      serverLogger.info('HTTP server closed');
      await Promise.all([disconnectPrisma(), new SearchService().disconnect()]);
      serverLogger.info('Shutdown complete');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
