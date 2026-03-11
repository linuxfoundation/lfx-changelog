// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { createAuthenticatedContext, createUnauthenticatedContext } from '../../helpers/api.helper.js';
import { TEST_BLOG_POSTS } from '../../helpers/test-data.js';

import type { APIRequestContext } from '@playwright/test';

const PUBLISHED_COUNT = TEST_BLOG_POSTS.filter((p) => p.status === 'published').length;

test.describe('Blog Search API', () => {
  let unauthenticatedApi: APIRequestContext;
  let superAdminApi: APIRequestContext;

  test.beforeAll(async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    unauthenticatedApi = await createUnauthenticatedContext(baseURL);
    superAdminApi = await createAuthenticatedContext('super_admin', baseURL);

    // Trigger reindex so OpenSearch has data for blog search tests
    const reindexRes = await superAdminApi.post('/api/opensearch/reindex?target=blogs');
    expect(reindexRes.status()).toBe(200);
  });

  test.afterAll(async () => {
    await unauthenticatedApi.dispose();
    await superAdminApi.dispose();
  });

  test.describe('GET /public/api/search?target=blogs', () => {
    test('should return search results with correct shape', async () => {
      const res = await unauthenticatedApi.get('/public/api/search?target=blogs&q=E2E');
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.hits)).toBe(true);
      expect(typeof body.total).toBe('number');
      expect(body.total).toBeLessThanOrEqual(PUBLISHED_COUNT);
      expect(typeof body.page).toBe('number');
      expect(typeof body.pageSize).toBe('number');
      expect(typeof body.totalPages).toBe('number');
      expect(body.facets).toBeDefined();
      expect(Array.isArray(body.facets.types)).toBe(true);
    });

    test('should return hits matching the search query', async () => {
      const res = await unauthenticatedApi.get('/public/api/search?target=blogs&q=EasyCLA');
      const body = await res.json();

      expect(body.total).toBeGreaterThanOrEqual(1);
      const titles = body.hits.map((h: { title: string }) => h.title.toLowerCase());
      expect(titles.some((t: string) => t.includes('easycla'))).toBe(true);
    });

    test('should include score and highlights in hits', async () => {
      const res = await unauthenticatedApi.get('/public/api/search?target=blogs&q=EasyCLA');
      const body = await res.json();

      expect(body.hits.length).toBeGreaterThan(0);
      const firstHit = body.hits[0];
      expect(firstHit.score).toBeGreaterThan(0);
      expect(firstHit.highlights).toBeDefined();
    });

    test('should support type filtering', async () => {
      const res = await unauthenticatedApi.get('/public/api/search?target=blogs&q=E2E&type=monthly_roundup');
      const body = await res.json();

      expect(body.success).toBe(true);
      for (const hit of body.hits) {
        expect(hit.type).toBe('monthly_roundup');
      }
    });

    test('should support pagination with page and limit', async () => {
      const res = await unauthenticatedApi.get('/public/api/search?target=blogs&q=E2E&limit=1');
      const body = await res.json();

      expect(body.pageSize).toBe(1);
      expect(body.hits.length).toBeLessThanOrEqual(1);
    });

    test('should return empty results for non-matching query', async () => {
      const res = await unauthenticatedApi.get('/public/api/search?target=blogs&q=xyznonexistent123');
      const body = await res.json();

      expect(body.total).toBe(0);
      expect(body.hits).toHaveLength(0);
    });

    test('should return 400 when q parameter is missing', async () => {
      const res = await unauthenticatedApi.get('/public/api/search?target=blogs');
      expect(res.status()).toBe(400);
    });

    test('should only return published entries', async () => {
      // "Draft" is in the title of a draft entry — searching for it should return 0 results
      // because only published entries are indexed
      const res = await unauthenticatedApi.get('/public/api/search?target=blogs&q=Draft');
      const body = await res.json();

      // All returned hits should have status === 'published'
      for (const hit of body.hits) {
        expect(hit.status).toBe('published');
      }
    });

    test('should return type facets', async () => {
      const res = await unauthenticatedApi.get('/public/api/search?target=blogs&q=E2E');
      const body = await res.json();

      expect(body.facets.types.length).toBeGreaterThan(0);
      for (const facet of body.facets.types) {
        expect(facet.key).toBeDefined();
        expect(typeof facet.count).toBe('number');
        expect(facet.count).toBeGreaterThan(0);
      }
    });
  });

  test.describe('POST /api/opensearch/reindex?target=blogs', () => {
    test('should return 401 without auth', async () => {
      const res = await unauthenticatedApi.post('/api/opensearch/reindex?target=blogs');
      expect(res.status()).toBe(401);
    });

    test('should return 403 for non-super-admin users', async ({}, testInfo) => {
      const baseURL = testInfo.project.use.baseURL as string;
      const editorApi = await createAuthenticatedContext('editor', baseURL);
      try {
        const res = await editorApi.post('/api/opensearch/reindex?target=blogs');
        expect(res.status()).toBe(403);
      } finally {
        await editorApi.dispose();
      }
    });

    test('should return reindex result for super_admin', async () => {
      const res = await superAdminApi.post('/api/opensearch/reindex?target=blogs');
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.blogs).toBeDefined();
      expect(typeof body.data.blogs.indexed).toBe('number');
      expect(typeof body.data.blogs.errors).toBe('number');
      expect(body.data.blogs.errors).toBe(0);
      expect(body.data.blogs.indexed).toBe(PUBLISHED_COUNT);
    });
  });
});
