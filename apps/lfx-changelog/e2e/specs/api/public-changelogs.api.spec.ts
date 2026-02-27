// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { createUnauthenticatedContext } from '../../helpers/api.helper.js';
import { activateProduct, deactivateProduct } from '../../helpers/db.helper.js';
import { TEST_CHANGELOGS } from '../../helpers/test-data.js';

import type { APIRequestContext } from '@playwright/test';

const PUBLISHED_COUNT = TEST_CHANGELOGS.filter((c) => c.status === 'published').length;

test.describe('Public Changelogs API', () => {
  let api: APIRequestContext;

  test.beforeAll(async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    api = await createUnauthenticatedContext(baseURL);
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test.describe('GET /public/api/changelogs', () => {
    test('should return paginated response with correct shape', async () => {
      const res = await api.get('/public/api/changelogs');
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(typeof body.total).toBe('number');
      expect(typeof body.page).toBe('number');
      expect(typeof body.pageSize).toBe('number');
      expect(typeof body.totalPages).toBe('number');
    });

    test('should only return published entries', async () => {
      const res = await api.get('/public/api/changelogs');
      const body = await res.json();

      expect(body.total).toBe(PUBLISHED_COUNT);
      for (const entry of body.data) {
        expect(entry.status).toBe('published');
      }
    });

    test('should support pagination with page and limit', async () => {
      const res = await api.get('/public/api/changelogs?page=1&limit=1');
      const body = await res.json();

      expect(body.page).toBe(1);
      expect(body.pageSize).toBe(1);
      expect(body.data).toHaveLength(1);
      expect(body.totalPages).toBe(PUBLISHED_COUNT);
    });

    test('should support productId filtering', async () => {
      // First, get products to find a valid ID
      const productsRes = await api.get('/public/api/products');
      const products = (await productsRes.json()).data;
      const easycla = products.find((p: any) => p.slug === 'e2e-easycla');

      const res = await api.get(`/public/api/changelogs?productId=${easycla.id}`);
      const body = await res.json();

      expect(body.success).toBe(true);
      for (const entry of body.data) {
        expect(entry.product.slug).toBe('e2e-easycla');
      }
    });

    test('should include product and author relations', async () => {
      const res = await api.get('/public/api/changelogs');
      const body = await res.json();
      const entry = body.data[0];

      expect(entry.product).toBeDefined();
      expect(entry.product.id).toBeDefined();
      expect(entry.product.name).toBeDefined();
      expect(entry.product.slug).toBeDefined();

      expect(entry.author).toBeDefined();
      expect(entry.author.id).toBeDefined();
      expect(entry.author.name).toBeDefined();
    });
  });

  test.describe('GET /public/api/changelogs/:id', () => {
    test('should return a single published entry by ID', async () => {
      // Get list first to discover an ID
      const listRes = await api.get('/public/api/changelogs');
      const listBody = await listRes.json();
      const entryId = listBody.data[0].id;

      const res = await api.get(`/public/api/changelogs/${entryId}`);
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(entryId);
      expect(body.data.product).toBeDefined();
      expect(body.data.author).toBeDefined();
    });

    test('should return 404 for non-existent ID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await api.get(`/public/api/changelogs/${fakeId}`);
      expect(res.status()).toBe(404);

      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });
  });

  test.describe('inactive product filtering', () => {
    const targetSlug = 'e2e-easycla';

    test('should exclude changelogs from deactivated products', async () => {
      await deactivateProduct(targetSlug);
      try {
        const res = await api.get('/public/api/changelogs');
        const body = await res.json();

        for (const entry of body.data) {
          expect(entry.product.slug).not.toBe(targetSlug);
        }

        const publishedFromTarget = TEST_CHANGELOGS.filter((c) => c.productSlug === targetSlug && c.status === 'published').length;
        expect(body.total).toBe(PUBLISHED_COUNT - publishedFromTarget);
      } finally {
        await activateProduct(targetSlug);
      }
    });

    test('should return 404 for changelog from deactivated product by ID', async () => {
      // Get a changelog ID from the target product
      const listRes = await api.get('/public/api/changelogs');
      const listBody = await listRes.json();
      const targetEntry = listBody.data.find((e: any) => e.product.slug === targetSlug);
      expect(targetEntry).toBeDefined();

      await deactivateProduct(targetSlug);
      try {
        const res = await api.get(`/public/api/changelogs/${targetEntry.id}`);
        expect(res.status()).toBe(404);
      } finally {
        await activateProduct(targetSlug);
      }
    });
  });
});
