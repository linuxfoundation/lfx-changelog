// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { createUnauthenticatedContext } from '../../helpers/api.helper.js';
import { activateProduct, deactivateProduct } from '../../helpers/db.helper.js';
import { TEST_PRODUCTS } from '../../helpers/test-data.js';

import type { APIRequestContext } from '@playwright/test';

test.describe('GET /public/api/products', () => {
  let api: APIRequestContext;

  test.beforeAll(async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    api = await createUnauthenticatedContext(baseURL);
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test('should return 200 with success response', async () => {
    const res = await api.get('/public/api/products');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('should return all seeded test products', async () => {
    const res = await api.get('/public/api/products');
    const body = await res.json();
    const slugs = body.data.map((p: any) => p.slug);

    for (const product of TEST_PRODUCTS) {
      expect(slugs).toContain(product.slug);
    }
  });

  test('should contain expected public fields', async () => {
    const res = await api.get('/public/api/products');
    const body = await res.json();
    const product = body.data.find((p: any) => p.slug === TEST_PRODUCTS[0]!.slug);

    expect(product).toBeDefined();
    expect(product.id).toBeDefined();
    expect(product.name).toBe(TEST_PRODUCTS[0]!.name);
    expect(product.slug).toBe(TEST_PRODUCTS[0]!.slug);
    expect(product.description).toBe(TEST_PRODUCTS[0]!.description);
    expect(product.faIcon).toBe(TEST_PRODUCTS[0]!.faIcon);
  });

  test('should NOT expose internal fields', async () => {
    const res = await api.get('/public/api/products');
    const body = await res.json();
    const product = body.data[0];

    expect(product.iconUrl).toBeUndefined();
    expect(product.githubInstallationId).toBeUndefined();
    expect(product.createdAt).toBeUndefined();
    expect(product.updatedAt).toBeUndefined();
  });

  test('should be accessible without authentication', async () => {
    const res = await api.get('/public/api/products');
    expect(res.status()).toBe(200);
  });

  test('should exclude deactivated products', async () => {
    const targetSlug = TEST_PRODUCTS[0]!.slug;

    await deactivateProduct(targetSlug);
    try {
      const res = await api.get('/public/api/products');
      const body = await res.json();
      const slugs = body.data.map((p: any) => p.slug);

      expect(slugs).not.toContain(targetSlug);
    } finally {
      await activateProduct(targetSlug);
    }
  });
});
