// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { serverLogger } from '../server-logger';

let prisma: PrismaClient;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    const connectionString = buildConnectionString();
    const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
    const adapter = new PrismaPg({
      connectionString,
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
    });
    prisma = new PrismaClient({ adapter });
    serverLogger.info('Prisma client initialized');
  }
  return prisma;
}

function buildConnectionString(): string {
  if (process.env['DATABASE_URL']) {
    return process.env['DATABASE_URL'];
  }

  const host = process.env['DB_HOST'];
  const port = process.env['DB_PORT'] || '5432';
  const name = process.env['DB_NAME'];
  const user = process.env['DB_USER'];
  const password = process.env['DB_PASSWORD'];

  if (!host || !name || !user || !password) {
    throw new Error('DATABASE_URL or DB_HOST/DB_NAME/DB_USER/DB_PASSWORD environment variables are required');
  }

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${name}`;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    serverLogger.info('Prisma client disconnected');
  }
}
