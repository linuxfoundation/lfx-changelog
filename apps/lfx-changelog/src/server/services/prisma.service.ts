import { PrismaClient } from '@prisma/client';

import { serverLogger } from '../server-logger';

let prisma: PrismaClient;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
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
