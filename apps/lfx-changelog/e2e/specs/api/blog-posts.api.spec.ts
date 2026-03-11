// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { createAuthenticatedContext, createUnauthenticatedContext } from '../../helpers/api.helper.js';
import { TEST_BLOG_POSTS } from '../../helpers/test-data.js';

import type { APIRequestContext } from '@playwright/test';

const TOTAL_BLOG_POSTS = TEST_BLOG_POSTS.length;
const PUBLISHED_BLOG_POSTS = TEST_BLOG_POSTS.filter((p) => p.status === 'published').length;

test.describe('Protected Blog Posts API (/api/blog-posts)', () => {
  let unauthApi: APIRequestContext;
  let superAdminApi: APIRequestContext;
  let editorApi: APIRequestContext;
  let userApi: APIRequestContext;

  test.beforeAll(async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    unauthApi = await createUnauthenticatedContext(baseURL);
    superAdminApi = await createAuthenticatedContext('super_admin', baseURL);
    editorApi = await createAuthenticatedContext('editor', baseURL);
    userApi = await createAuthenticatedContext('user', baseURL);
  });

  test.afterAll(async () => {
    await Promise.all([unauthApi.dispose(), superAdminApi.dispose(), editorApi.dispose(), userApi.dispose()]);
  });

  test.describe('Authentication (401)', () => {
    test('GET /api/blog-posts returns 401 without auth', async () => {
      const res = await unauthApi.get('/api/blog-posts');
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('POST /api/blog-posts returns 401 without auth', async () => {
      const res = await unauthApi.post('/api/blog-posts', {
        data: { title: 'Test', description: 'Test', type: 'monthly_roundup', slug: 'test-unauth' },
      });
      expect(res.status()).toBe(401);
    });
  });

  test.describe('Authorization (RBAC)', () => {
    test('user with no roles gets 403 on GET (insufficient permissions)', async () => {
      const res = await userApi.get('/api/blog-posts');
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('AUTHORIZATION_REQUIRED');
    });

    test('super_admin can GET blog posts (200)', async () => {
      const res = await superAdminApi.get('/api/blog-posts');
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    test('editor cannot POST blog posts (requires PRODUCT_ADMIN)', async () => {
      const res = await editorApi.post('/api/blog-posts', {
        data: { title: 'Forbidden', description: 'Test', type: 'monthly_roundup', slug: 'forbidden-post' },
      });
      expect(res.status()).toBe(403);
    });

    test('editor cannot DELETE blog posts (requires SUPER_ADMIN)', async () => {
      const listRes = await superAdminApi.get('/api/blog-posts');
      const posts = (await listRes.json()).data;
      const id = posts[0].id;

      const res = await editorApi.delete(`/api/blog-posts/${id}`);
      expect(res.status()).toBe(403);
    });
  });

  test.describe('List', () => {
    test('should return all entries (published + draft) for super_admin', async () => {
      const res = await superAdminApi.get('/api/blog-posts');
      const body = await res.json();

      expect(body.total).toBe(TOTAL_BLOG_POSTS);
      expect(body.data).toHaveLength(TOTAL_BLOG_POSTS);
    });

    test('should support pagination', async () => {
      const res = await superAdminApi.get('/api/blog-posts?page=1&limit=2');
      const body = await res.json();

      expect(body.page).toBe(1);
      expect(body.pageSize).toBe(2);
      expect(body.data).toHaveLength(2);
      expect(body.totalPages).toBe(Math.ceil(TOTAL_BLOG_POSTS / 2));
    });

    test('should include author relation', async () => {
      const res = await superAdminApi.get('/api/blog-posts');
      const body = await res.json();
      const post = body.data[0];

      expect(post.author).toBeDefined();
      expect(post.author.id).toBeDefined();
    });
  });

  test.describe('CRUD Lifecycle', () => {
    test('create → read → update → publish → unpublish → delete blog post (super_admin)', async () => {
      // CREATE (draft)
      const createRes = await superAdminApi.post('/api/blog-posts', {
        data: {
          title: 'API Test Blog Post',
          slug: 'api-test-blog-post',
          description: '## Test\n\nCreated by API test.',
          type: 'monthly_roundup',
          status: 'draft',
        },
      });
      expect(createRes.status()).toBe(201);
      const created = (await createRes.json()).data;
      expect(created.id).toBeDefined();
      expect(created.title).toBe('API Test Blog Post');
      expect(created.status).toBe('draft');
      expect(created.publishedAt).toBeNull();

      const postId = created.id;

      // READ
      const getRes = await superAdminApi.get(`/api/blog-posts/${postId}`);
      expect(getRes.status()).toBe(200);
      const fetched = (await getRes.json()).data;
      expect(fetched.id).toBe(postId);

      // UPDATE
      const updateRes = await superAdminApi.put(`/api/blog-posts/${postId}`, {
        data: { title: 'API Test Blog Post Updated' },
      });
      expect(updateRes.status()).toBe(200);
      const updated = (await updateRes.json()).data;
      expect(updated.title).toBe('API Test Blog Post Updated');

      // PUBLISH
      const publishRes = await superAdminApi.patch(`/api/blog-posts/${postId}/publish`);
      expect(publishRes.status()).toBe(200);
      const published = (await publishRes.json()).data;
      expect(published.status).toBe('published');
      expect(published.publishedAt).not.toBeNull();

      // UNPUBLISH
      const unpublishRes = await superAdminApi.patch(`/api/blog-posts/${postId}/unpublish`);
      expect(unpublishRes.status()).toBe(200);
      const unpublished = (await unpublishRes.json()).data;
      expect(unpublished.status).toBe('draft');
      expect(unpublished.publishedAt).toBeNull();

      // DELETE
      const deleteRes = await superAdminApi.delete(`/api/blog-posts/${postId}`);
      expect(deleteRes.status()).toBe(204);

      // VERIFY DELETED
      const verifyRes = await superAdminApi.get(`/api/blog-posts/${postId}`);
      expect(verifyRes.status()).toBe(404);
    });
  });

  test.describe('Slug', () => {
    test('create with slug stores slug correctly', async () => {
      const slug = `e2e-slug-test-${Date.now()}`;
      const createRes = await superAdminApi.post('/api/blog-posts', {
        data: { title: 'Slug Test', description: 'Test', type: 'monthly_roundup', status: 'draft', slug },
      });
      expect(createRes.status()).toBe(201);
      const created = (await createRes.json()).data;
      expect(created.slug).toBe(slug);

      // Cleanup
      await superAdminApi.delete(`/api/blog-posts/${created.id}`);
    });

    test('create with duplicate slug auto-suffixes to ensure uniqueness', async () => {
      const slug = `e2e-dup-slug-${Date.now()}`;

      const first = await superAdminApi.post('/api/blog-posts', {
        data: { title: 'First', description: 'Test', type: 'monthly_roundup', status: 'draft', slug },
      });
      expect(first.status()).toBe(201);
      const firstData = (await first.json()).data;
      expect(firstData.slug).toBe(slug);

      const second = await superAdminApi.post('/api/blog-posts', {
        data: { title: 'Second', description: 'Test', type: 'monthly_roundup', status: 'draft', slug },
      });
      expect(second.status()).toBe(201);
      const secondData = (await second.json()).data;
      // Service auto-appends a numeric suffix for uniqueness
      expect(secondData.slug).toBe(`${slug}-2`);

      // Cleanup
      await superAdminApi.delete(`/api/blog-posts/${firstData.id}`);
      await superAdminApi.delete(`/api/blog-posts/${secondData.id}`);
    });

    test('create with invalid slug format returns 400', async () => {
      const res = await superAdminApi.post('/api/blog-posts', {
        data: { title: 'Bad Slug', description: 'Test', type: 'monthly_roundup', status: 'draft', slug: 'UPPERCASE-Not-Valid' },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  test.describe('Validation', () => {
    test('POST with missing required fields returns 400', async () => {
      const res = await superAdminApi.post('/api/blog-posts', {
        data: { title: 'Missing fields' },
      });
      expect(res.status()).toBe(400);

      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(body.details)).toBe(true);
      expect(body.details.length).toBeGreaterThan(0);
    });
  });

  test.describe('Link Products', () => {
    test('should link products to a blog post', async () => {
      // Create a blog post
      const createRes = await superAdminApi.post('/api/blog-posts', {
        data: { title: 'Link Products Test', description: 'Test', type: 'monthly_roundup', slug: `link-products-${Date.now()}` },
      });
      expect(createRes.status()).toBe(201);
      const postId = (await createRes.json()).data.id;

      // Get product IDs
      const productsRes = await superAdminApi.get('/api/products');
      const products = (await productsRes.json()).data;
      const productIds = products.slice(0, 2).map((p: any) => p.id);

      // Link products
      const linkRes = await superAdminApi.post(`/api/blog-posts/${postId}/link-products`, {
        data: { productIds },
      });
      expect(linkRes.status()).toBe(200);
      const linked = (await linkRes.json()).data;
      expect(linked.products).toBeDefined();
      expect(linked.products.length).toBe(2);

      // Cleanup
      await superAdminApi.delete(`/api/blog-posts/${postId}`);
    });
  });

  test.describe('Link Changelogs', () => {
    test('should link changelog entries to a blog post', async () => {
      // Create a blog post
      const createRes = await superAdminApi.post('/api/blog-posts', {
        data: { title: 'Link Changelogs Test', description: 'Test', type: 'monthly_roundup', slug: `link-changelogs-${Date.now()}` },
      });
      expect(createRes.status()).toBe(201);
      const postId = (await createRes.json()).data.id;

      // Get changelog entry IDs
      const changelogsRes = await superAdminApi.get('/api/changelogs');
      const changelogs = (await changelogsRes.json()).data;
      const changelogEntryIds = changelogs.slice(0, 2).map((c: any) => c.id);

      // Link changelogs
      const linkRes = await superAdminApi.post(`/api/blog-posts/${postId}/link-changelogs`, {
        data: { changelogEntryIds },
      });
      expect(linkRes.status()).toBe(200);
      const linked = (await linkRes.json()).data;
      expect(linked.changelogs).toBeDefined();
      expect(linked.changelogs.length).toBe(2);

      // Cleanup
      await superAdminApi.delete(`/api/blog-posts/${postId}`);
    });
  });
});

test.describe('Public Blog API (/public/api/blog)', () => {
  let publicApi: APIRequestContext;

  test.beforeAll(async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    publicApi = await createUnauthenticatedContext(baseURL);
  });

  test.afterAll(async () => {
    await publicApi.dispose();
  });

  test.describe('List Published', () => {
    test('should return only published blog posts', async () => {
      const res = await publicApi.get('/public/api/blog');
      expect(res.status()).toBe(200);
      const body = await res.json();

      expect(body.data).toHaveLength(PUBLISHED_BLOG_POSTS);
      for (const post of body.data) {
        expect(post.status).toBe('published');
      }
    });

    test('should support type filter', async () => {
      const res = await publicApi.get('/public/api/blog?type=monthly_roundup');
      expect(res.status()).toBe(200);
      const body = await res.json();

      for (const post of body.data) {
        expect(post.type).toBe('monthly_roundup');
      }
    });
  });

  test.describe('Get by Slug', () => {
    test('should return published post by slug', async () => {
      const res = await publicApi.get('/public/api/blog/e2e-january-2026-roundup');
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.data.title).toBe('E2E: January 2026 Monthly Roundup');
      expect(body.data.status).toBe('published');
    });

    test('should return 404 for draft slug', async () => {
      const res = await publicApi.get('/public/api/blog/e2e-draft-upcoming-features');
      expect(res.status()).toBe(404);
    });

    test('should return 404 for nonexistent slug', async () => {
      const res = await publicApi.get('/public/api/blog/this-slug-does-not-exist');
      expect(res.status()).toBe(404);
    });
  });
});
