// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { CHANGELOGS_INDEX } from '@lfx-changelog/shared';
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

export function startTestOpenSearch(): void {
  execFileSync('docker', ['compose', '-f', composeFile, 'up', '-d', 'opensearch-test'], {
    stdio: 'inherit',
  });
}

export function waitForTestOpenSearch(retries = 60): void {
  for (let i = 0; i < retries; i++) {
    try {
      execFileSync('curl', ['-sf', 'http://localhost:9202/_cluster/health'], {
        stdio: 'ignore',
      });
      return;
    } catch {
      execFileSync('sleep', ['1']);
    }
  }
  throw new Error('opensearch-test did not become ready within 60s');
}

export function cleanTestOpenSearch(): void {
  try {
    execFileSync('curl', ['-sf', '-X', 'DELETE', `http://localhost:9202/${CHANGELOGS_INDEX}`], {
      stdio: 'ignore',
    });
  } catch {
    // Index may not exist yet — safe to ignore
  }
}

export function runMigrations(): void {
  execFileSync('yarn', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    cwd: appDir,
  });
}
