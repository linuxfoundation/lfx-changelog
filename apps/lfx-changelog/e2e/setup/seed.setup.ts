// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { test } from '@playwright/test';
import { cleanTestDatabase, disconnectTestDb, seedTestDatabase } from '../helpers/db.helper.js';
import { runMigrations, startTestDatabase, waitForTestDatabase } from '../helpers/docker.helper.js';

test('start test database, migrate, and seed', async () => {
  test.setTimeout(60_000);

  startTestDatabase();
  waitForTestDatabase();
  runMigrations();

  await cleanTestDatabase();
  await seedTestDatabase();
  await disconnectTestDb();
});
