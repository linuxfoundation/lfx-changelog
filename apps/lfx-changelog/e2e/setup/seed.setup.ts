// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { test } from '@playwright/test';
import { cleanTestDatabase, disconnectTestDb, seedTestDatabase, seedTestOpenSearch } from '../helpers/db.helper.js';
import {
  cleanTestOpenSearch,
  runMigrations,
  startTestDatabase,
  startTestOpenSearch,
  waitForTestDatabase,
  waitForTestOpenSearch,
} from '../helpers/docker.helper.js';

test('start test database and opensearch, migrate, and seed', async () => {
  test.setTimeout(120_000);

  startTestDatabase();
  startTestOpenSearch();
  waitForTestDatabase();
  waitForTestOpenSearch();
  cleanTestOpenSearch();
  runMigrations();

  await cleanTestDatabase();
  await seedTestDatabase();
  await seedTestOpenSearch();
  await disconnectTestDb();
});
