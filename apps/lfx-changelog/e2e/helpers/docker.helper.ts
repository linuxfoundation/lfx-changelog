// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { execFileSync } from 'child_process';
import { join } from 'path';

const appDir = process.cwd();
const rootDir = join(appDir, '../..');
const composeFile = join(rootDir, 'docker-compose.yml');

export function startTestDatabase(): void {
  execFileSync('docker', ['compose', '-f', composeFile, 'up', '-d', 'postgres-test'], {
    stdio: 'inherit',
  });
}

export function waitForTestDatabase(retries = 30): void {
  for (let i = 0; i < retries; i++) {
    try {
      execFileSync('docker', ['compose', '-f', composeFile, 'exec', '-T', 'postgres-test', 'pg_isready', '-U', 'changelog', '-d', 'lfx_changelog_test'], {
        stdio: 'ignore',
      });
      return;
    } catch {
      execFileSync('sleep', ['1']);
    }
  }
  throw new Error('postgres-test did not become ready within 30s');
}

export function runMigrations(): void {
  execFileSync('yarn', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    cwd: appDir,
  });
}
