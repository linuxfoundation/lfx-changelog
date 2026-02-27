// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { readFileSync } from 'fs';

import { request } from '@playwright/test';

import type { APIRequestContext } from '@playwright/test';

type TestRole = 'super_admin' | 'product_admin' | 'editor' | 'user';

const roleToFile: Record<TestRole, string> = {
  super_admin: 'e2e/.auth/super-admin.json',
  product_admin: 'e2e/.auth/product-admin.json',
  editor: 'e2e/.auth/editor.json',
  user: 'e2e/.auth/user.json',
};

function extractCookies(storageStatePath: string, domain: string): string {
  const raw = readFileSync(storageStatePath, 'utf-8');
  const state = JSON.parse(raw) as { cookies: Array<{ name: string; value: string; domain: string }> };
  return state.cookies
    .filter((c) => c.domain === domain)
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

export async function createAuthenticatedContext(role: TestRole, baseURL: string): Promise<APIRequestContext> {
  const cookieHeader = extractCookies(roleToFile[role], 'localhost');
  return request.newContext({
    baseURL,
    extraHTTPHeaders: { Cookie: cookieHeader },
  });
}

export async function createUnauthenticatedContext(baseURL: string): Promise<APIRequestContext> {
  return request.newContext({ baseURL });
}
