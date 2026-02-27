// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

config({ path: '.env.e2e' });

const baseURL = 'http://localhost:4204';

export default defineConfig({
  testDir: './e2e/specs',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // --- Setup: docker, migrations, seed ---
    {
      name: 'setup',
      testDir: './e2e/setup',
      testMatch: /seed\.setup\.ts/,
    },

    // --- Auth: logs in all roles, saves storage state files ---
    {
      name: 'auth',
      testDir: './e2e/setup',
      testMatch: /auth\.setup\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
      },
    },

    // --- Test projects ---
    {
      name: 'public',
      testMatch: /public\/.*\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
      },
    },

    {
      name: 'admin-super-admin',
      testMatch: /admin\/(?!rbac-).*\.spec\.ts/,
      dependencies: ['auth'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: './e2e/.auth/super-admin.json',
      },
    },

    {
      name: 'admin-rbac',
      testMatch: /admin\/rbac-.*\.spec\.ts/,
      dependencies: ['auth'],
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  webServer: {
    command: 'yarn start',
    url: `${baseURL}/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'ignore',
    env: {
      ...process.env,
    },
  },
});
