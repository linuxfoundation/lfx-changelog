// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { serverLogger } from '../server-logger';

let prisma: PrismaClient;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    const connectionString = process.env['DATABASE_URL'];
    const isLocal = connectionString?.includes('localhost') || connectionString?.includes('127.0.0.1');
    const adapter = new PrismaPg({
      connectionString,
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
    });
    prisma = new PrismaClient({ adapter });
    serverLogger.info('Prisma client initialized');
  }
  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    serverLogger.info('Prisma client disconnected');
  }
}
