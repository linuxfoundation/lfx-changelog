// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { test } from '@playwright/test';
import { expectAdminDashboard, loginViaAuth0 } from '../helpers/auth.helper.js';
import { TEST_USERS } from '../helpers/test-data.js';

const roleToFile: Record<string, string> = {
  super_admin: 'e2e/.auth/super-admin.json',
  product_admin: 'e2e/.auth/product-admin.json',
  editor: 'e2e/.auth/editor.json',
  user: 'e2e/.auth/user.json',
};

// Roles that have DB role assignments and can access the admin section
const adminRoles = new Set(['super_admin', 'product_admin', 'editor']);

for (const user of TEST_USERS) {
  test(`authenticate ${user.role}`, async ({ page, context }) => {
    const username = process.env[`E2E_${user.role.toUpperCase()}_USERNAME`] || user.email;
    const password = process.env[`E2E_${user.role.toUpperCase()}_PASSWORD`] || '';

    if (adminRoles.has(user.role)) {
      await loginViaAuth0(page, username, password, '/admin');
      await expectAdminDashboard(page);
    } else {
      // No-role users get redirected to public feed by the auth guard
      await loginViaAuth0(page, username, password, '/');
    }

    await context.storageState({ path: roleToFile[user.role]! });
  });
}
