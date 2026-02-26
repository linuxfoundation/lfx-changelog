import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { serverLogger } from '../server-logger';

let prisma: PrismaClient;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
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
