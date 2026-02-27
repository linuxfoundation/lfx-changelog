// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { serverLogger } from '../server-logger';

/**
 * Builds a PostgreSQL connection string from environment variables.
 * Prefers DATABASE_URL if set; otherwise assembles from individual DB_* vars.
 * Special characters in user/password are percent-encoded via encodeURIComponent.
 */
export function buildConnectionString(): string {
  if (process.env['DATABASE_URL']) {
    const url = process.env['DATABASE_URL'];
    serverLogger.info({ source: 'DATABASE_URL', length: url.length }, 'buildConnectionString: using DATABASE_URL env var');
    return url;
  }

  const host = process.env['DB_HOST'];
  const port = process.env['DB_PORT'] || '5432';
  const name = process.env['DB_NAME'];
  const user = process.env['DB_USER'];
  const password = process.env['DB_PASSWORD'];

  serverLogger.info({ host, port, db: name, user, passwordLength: password?.length ?? 0 }, 'buildConnectionString: assembling from individual DB_* vars');

  if (!host || !name || !user || !password) {
    throw new Error('DATABASE_URL or DB_HOST/DB_NAME/DB_USER/DB_PASSWORD environment variables are required');
  }

  const connectionString = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${name}`;
  serverLogger.info({ length: connectionString.length }, 'buildConnectionString: connection string built');
  return connectionString;
}
