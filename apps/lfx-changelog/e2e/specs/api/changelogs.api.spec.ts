// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { createAuthenticatedContext, createUnauthenticatedContext } from '../../helpers/api.helper.js';
import { TEST_CHANGELOGS } from '../../helpers/test-data.js';

import type { APIRequestContext } from '@playwright/test';

const TOTAL_CHANGELOGS = TEST_CHANGELOGS.length;

/** Discover the seeded product ID for a given slug via the super admin API. */
async function getProductId(api: APIRequestContext, slug: string): Promise<string> {
  const res = await api.get('/api/products');
  const products = (await res.json()).data;
  const product = products.find((p: any) => p.slug === slug);
  if (!product) throw new Error(`Product not found for slug: ${slug}`);
  return product.id;
}

test.describe('Protected Changelogs API (/api/changelogs)', () => {
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
    test('GET /api/changelogs returns 401 without auth', async () => {
      const res = await unauthApi.get('/api/changelogs');
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('POST /api/changelogs returns 401 without auth', async () => {
      const res = await unauthApi.post('/api/changelogs', {
        data: { title: 'Test', description: 'Test', productId: 'fake', version: '1.0.0', status: 'draft' },
      });
      expect(res.status()).toBe(401);
    });
  });

  test.describe('Authorization (RBAC)', () => {
    test('user with no roles gets 403 on GET (insufficient permissions)', async () => {
      const res = await userApi.get('/api/changelogs');
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('AUTHORIZATION_REQUIRED');
    });

    test('super_admin can GET changelogs (200)', async () => {
      const res = await superAdminApi.get('/api/changelogs');
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    test('editor cannot DELETE changelogs (requires PRODUCT_ADMIN)', async () => {
      // Get a real changelog entry ID first
      const listRes = await superAdminApi.get('/api/changelogs');
      const entries = (await listRes.json()).data;
      const id = entries[0].id;

      const res = await editorApi.delete(`/api/changelogs/${id}`);
      expect(res.status()).toBe(403);
    });
  });

  test.describe('List', () => {
    test('should return all entries (published + draft) for super_admin', async () => {
      const res = await superAdminApi.get('/api/changelogs');
      const body = await res.json();

      expect(body.total).toBe(TOTAL_CHANGELOGS);
      expect(body.data).toHaveLength(TOTAL_CHANGELOGS);
    });

    test('should support pagination', async () => {
      const res = await superAdminApi.get('/api/changelogs?page=1&limit=2');
      const body = await res.json();

      expect(body.page).toBe(1);
      expect(body.pageSize).toBe(2);
      expect(body.data).toHaveLength(2);
      expect(body.totalPages).toBe(Math.ceil(TOTAL_CHANGELOGS / 2));
    });

    test('should include product and author relations', async () => {
      const res = await superAdminApi.get('/api/changelogs');
      const body = await res.json();
      const entry = body.data[0];

      expect(entry.product).toBeDefined();
      expect(entry.product.id).toBeDefined();
      expect(entry.author).toBeDefined();
      expect(entry.author.id).toBeDefined();
    });
  });

  test.describe('CRUD Lifecycle', () => {
    test('create → read → update → publish → unpublish → delete changelog (super_admin)', async () => {
      // Discover a product ID from the seeded data
      const productsRes = await superAdminApi.get('/api/products');
      const products = (await productsRes.json()).data;
      const product = products.find((p: any) => p.slug === 'e2e-easycla');
      expect(product).toBeDefined();
      const productId = product.id;

      // CREATE (draft)
      const createRes = await superAdminApi.post('/api/changelogs', {
        data: {
          productId,
          title: 'API Test Changelog Entry',
          description: '## Test\n\nCreated by API test.',
          version: '99.0.0',
          status: 'draft',
        },
      });
      expect(createRes.status()).toBe(201);
      const created = (await createRes.json()).data;
      expect(created.id).toBeDefined();
      expect(created.title).toBe('API Test Changelog Entry');
      expect(created.status).toBe('draft');
      expect(created.publishedAt).toBeNull();

      const entryId = created.id;

      // READ
      const getRes = await superAdminApi.get(`/api/changelogs/${entryId}`);
      expect(getRes.status()).toBe(200);
      const fetched = (await getRes.json()).data;
      expect(fetched.id).toBe(entryId);
      expect(fetched.product.id).toBe(productId);

      // UPDATE
      const updateRes = await superAdminApi.put(`/api/changelogs/${entryId}`, {
        data: { title: 'API Test Changelog Updated' },
      });
      expect(updateRes.status()).toBe(200);
      const updated = (await updateRes.json()).data;
      expect(updated.title).toBe('API Test Changelog Updated');

      // PUBLISH
      const publishRes = await superAdminApi.patch(`/api/changelogs/${entryId}/publish`);
      expect(publishRes.status()).toBe(200);
      const published = (await publishRes.json()).data;
      expect(published.status).toBe('published');
      expect(published.publishedAt).not.toBeNull();

      // UNPUBLISH
      const unpublishRes = await superAdminApi.patch(`/api/changelogs/${entryId}/unpublish`);
      expect(unpublishRes.status()).toBe(200);
      const unpublished = (await unpublishRes.json()).data;
      expect(unpublished.status).toBe('draft');
      expect(unpublished.publishedAt).toBeNull();
      expect(unpublished.product).toBeDefined();
      expect(unpublished.author).toBeDefined();

      // DELETE
      const deleteRes = await superAdminApi.delete(`/api/changelogs/${entryId}`);
      expect(deleteRes.status()).toBe(204);

      // VERIFY DELETED
      const verifyRes = await superAdminApi.get(`/api/changelogs/${entryId}`);
      expect(verifyRes.status()).toBe(404);
    });
  });

  test.describe('Unpublish', () => {
    let productId: string;

    test.beforeAll(async () => {
      const productsRes = await superAdminApi.get('/api/products');
      productId = (await productsRes.json()).data.find((p: any) => p.slug === 'e2e-easycla').id;
    });

    test('PATCH /api/changelogs/:id/unpublish returns 401 without auth', async () => {
      const listRes = await superAdminApi.get('/api/changelogs');
      const entries = (await listRes.json()).data;
      const id = entries[0].id;

      const res = await unauthApi.patch(`/api/changelogs/${id}/unpublish`);
      expect(res.status()).toBe(401);
    });

    test('unpublish reverts published entry to draft', async () => {
      // Create and publish an entry
      const createRes = await superAdminApi.post('/api/changelogs', {
        data: { productId, title: 'Unpublish Test', description: 'Test', version: '1.0.0', status: 'draft' },
      });
      const entryId = (await createRes.json()).data.id;
      await superAdminApi.patch(`/api/changelogs/${entryId}/publish`);

      // Unpublish
      const res = await superAdminApi.patch(`/api/changelogs/${entryId}/unpublish`);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('draft');
      expect(body.data.publishedAt).toBeNull();

      // Verify via GET
      const getRes = await superAdminApi.get(`/api/changelogs/${entryId}`);
      const fetched = (await getRes.json()).data;
      expect(fetched.status).toBe('draft');
      expect(fetched.publishedAt).toBeNull();

      // Cleanup
      await superAdminApi.delete(`/api/changelogs/${entryId}`);
    });

    test('unpublish non-existent entry returns 404', async () => {
      const res = await superAdminApi.patch('/api/changelogs/00000000-0000-0000-0000-000000000000/unpublish');
      expect(res.status()).toBe(404);
    });

    test('editor can unpublish entries (has EDITOR role)', async () => {
      const createRes = await superAdminApi.post('/api/changelogs', {
        data: { productId, title: 'Editor Unpublish Test', description: 'Test', version: '1.0.0', status: 'draft' },
      });
      const entryId = (await createRes.json()).data.id;
      await superAdminApi.patch(`/api/changelogs/${entryId}/publish`);

      const res = await editorApi.patch(`/api/changelogs/${entryId}/unpublish`);
      expect(res.status()).toBe(200);
      expect((await res.json()).data.status).toBe('draft');

      // Cleanup
      await superAdminApi.delete(`/api/changelogs/${entryId}`);
    });

    test('user with no roles gets 403 on unpublish', async () => {
      const createRes = await superAdminApi.post('/api/changelogs', {
        data: { productId, title: 'Forbidden Unpublish Test', description: 'Test', version: '1.0.0', status: 'draft' },
      });
      const entryId = (await createRes.json()).data.id;
      await superAdminApi.patch(`/api/changelogs/${entryId}/publish`);

      const res = await userApi.patch(`/api/changelogs/${entryId}/unpublish`);
      expect(res.status()).toBe(403);

      // Cleanup
      await superAdminApi.delete(`/api/changelogs/${entryId}`);
    });
  });

  test.describe('Slug', () => {
    let productId: string;

    test.beforeAll(async () => {
      const productsRes = await superAdminApi.get('/api/products');
      const products = (await productsRes.json()).data;
      productId = products.find((p: any) => p.slug === 'e2e-easycla').id;
    });

    test('create with slug stores slug correctly', async () => {
      const slug = `e2e-slug-test-${Date.now()}`;
      const createRes = await superAdminApi.post('/api/changelogs', {
        data: { productId, title: 'Slug Test', description: 'Test', version: '1.0.0', status: 'draft', slug },
      });
      expect(createRes.status()).toBe(201);
      const created = (await createRes.json()).data;
      expect(created.slug).toBe(slug);

      // Cleanup
      await superAdminApi.delete(`/api/changelogs/${created.id}`);
    });

    test('create with duplicate slug returns 409', async () => {
      const slug = `e2e-dup-slug-${Date.now()}`;

      const first = await superAdminApi.post('/api/changelogs', {
        data: { productId, title: 'First', description: 'Test', version: '1.0.0', status: 'draft', slug },
      });
      expect(first.status()).toBe(201);
      const firstId = (await first.json()).data.id;

      const second = await superAdminApi.post('/api/changelogs', {
        data: { productId, title: 'Second', description: 'Test', version: '1.0.0', status: 'draft', slug },
      });
      expect(second.status()).toBe(409);
      const body = await second.json();
      expect(body.code).toBe('CONFLICT');

      // Cleanup
      await superAdminApi.delete(`/api/changelogs/${firstId}`);
    });

    test('create with invalid slug format returns 400', async () => {
      const res = await superAdminApi.post('/api/changelogs', {
        data: { productId, title: 'Bad Slug', description: 'Test', version: '1.0.0', status: 'draft', slug: 'UPPERCASE-Not-Valid' },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    test('update slug to a duplicate returns 409', async () => {
      const slugA = `e2e-slug-a-${Date.now()}`;
      const slugB = `e2e-slug-b-${Date.now()}`;

      const a = await superAdminApi.post('/api/changelogs', {
        data: { productId, title: 'Entry A', description: 'Test', version: '1.0.0', status: 'draft', slug: slugA },
      });
      const b = await superAdminApi.post('/api/changelogs', {
        data: { productId, title: 'Entry B', description: 'Test', version: '1.0.0', status: 'draft', slug: slugB },
      });
      const idA = (await a.json()).data.id;
      const idB = (await b.json()).data.id;

      const updateRes = await superAdminApi.put(`/api/changelogs/${idB}`, { data: { slug: slugA } });
      expect(updateRes.status()).toBe(409);

      // Cleanup
      await superAdminApi.delete(`/api/changelogs/${idA}`);
      await superAdminApi.delete(`/api/changelogs/${idB}`);
    });

    test('update slug with invalid format returns 400', async () => {
      const slug = `e2e-valid-slug-${Date.now()}`;
      const createRes = await superAdminApi.post('/api/changelogs', {
        data: { productId, title: 'Valid Entry', description: 'Test', version: '1.0.0', status: 'draft', slug },
      });
      const id = (await createRes.json()).data.id;

      const updateRes = await superAdminApi.put(`/api/changelogs/${id}`, { data: { slug: 'Has Spaces And CAPS!' } });
      expect(updateRes.status()).toBe(400);

      // Cleanup
      await superAdminApi.delete(`/api/changelogs/${id}`);
    });
  });

  test.describe('Validation', () => {
    test('POST with missing required fields returns 400', async () => {
      const res = await superAdminApi.post('/api/changelogs', {
        data: { title: 'Missing fields' },
      });
      expect(res.status()).toBe(400);

      const body = await res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(body.details)).toBe(true);
      expect(body.details.length).toBeGreaterThan(0);
    });
  });

  test.describe('Author Reassignment', () => {
    let productId: string;
    let superAdminUserId: string;
    let editorUserId: string;

    test.beforeAll(async () => {
      const productsRes = await superAdminApi.get('/api/products');
      productId = (await productsRes.json()).data.find((p: any) => p.slug === 'e2e-easycla').id;

      const superAdminMeRes = await superAdminApi.get('/api/users/me');
      superAdminUserId = (await superAdminMeRes.json()).data.id;

      const editorMeRes = await editorApi.get('/api/users/me');
      editorUserId = (await editorMeRes.json()).data.id;
    });

    test('super_admin can reassign createdBy to another user', async () => {
      const createRes = await superAdminApi.post('/api/changelogs', {
        data: { productId, title: 'Reassign Test', description: 'Test', version: '1.0.0', status: 'draft' },
      });
      const entryId = (await createRes.json()).data.id;

      const updateRes = await superAdminApi.put(`/api/changelogs/${entryId}`, {
        data: { createdBy: editorUserId },
      });
      expect(updateRes.status()).toBe(200);
      const updated = (await updateRes.json()).data;
      expect(updated.createdBy).toBe(editorUserId);

      // Cleanup
      await superAdminApi.delete(`/api/changelogs/${entryId}`);
    });

    test('editor can self-claim createdBy (own user ID)', async () => {
      // Super admin creates an entry
      const createRes = await superAdminApi.post('/api/changelogs', {
        data: { productId, title: 'Self-Claim Test', description: 'Test', version: '1.0.0', status: 'draft' },
      });
      const entryId = (await createRes.json()).data.id;

      // Editor self-claims
      const updateRes = await editorApi.put(`/api/changelogs/${entryId}`, {
        data: { createdBy: editorUserId },
      });
      expect(updateRes.status()).toBe(200);
      const updated = (await updateRes.json()).data;
      expect(updated.createdBy).toBe(editorUserId);

      // Cleanup
      await superAdminApi.delete(`/api/changelogs/${entryId}`);
    });

    test('editor cannot reassign createdBy to another user (403)', async () => {
      const createRes = await superAdminApi.post('/api/changelogs', {
        data: { productId, title: 'Forbidden Reassign Test', description: 'Test', version: '1.0.0', status: 'draft' },
      });
      const entryId = (await createRes.json()).data.id;

      // Editor tries to reassign to super admin
      const updateRes = await editorApi.put(`/api/changelogs/${entryId}`, {
        data: { createdBy: superAdminUserId },
      });
      expect(updateRes.status()).toBe(403);
      const body = await updateRes.json();
      expect(body.code).toBe('AUTHORIZATION_REQUIRED');

      // Cleanup
      await superAdminApi.delete(`/api/changelogs/${entryId}`);
    });

    test('update with invalid createdBy returns 404', async () => {
      const createRes = await superAdminApi.post('/api/changelogs', {
        data: { productId, title: 'Invalid Author Test', description: 'Test', version: '1.0.0', status: 'draft' },
      });
      const entryId = (await createRes.json()).data.id;

      const updateRes = await superAdminApi.put(`/api/changelogs/${entryId}`, {
        data: { createdBy: '00000000-0000-0000-0000-000000000000' },
      });
      expect(updateRes.status()).toBe(404);

      // Cleanup
      await superAdminApi.delete(`/api/changelogs/${entryId}`);
    });

    test('update without createdBy does not change author', async () => {
      const createRes = await superAdminApi.post('/api/changelogs', {
        data: { productId, title: 'No Author Change Test', description: 'Test', version: '1.0.0', status: 'draft' },
      });
      const created = (await createRes.json()).data;

      const updateRes = await superAdminApi.put(`/api/changelogs/${created.id}`, {
        data: { title: 'Updated Title Only' },
      });
      expect(updateRes.status()).toBe(200);
      const updated = (await updateRes.json()).data;
      expect(updated.createdBy).toBe(created.createdBy);

      // Cleanup
      await superAdminApi.delete(`/api/changelogs/${created.id}`);
    });
  });

  test.describe('Draft Visibility (RBAC scoping)', () => {
    // The editor has EDITOR role scoped to e2e-easycla only.
    // Drafts on other products should be invisible to the editor.
    let easyclaProductId: string;
    let securityProductId: string;
    let securityDraftId: string;

    test.beforeAll(async () => {
      easyclaProductId = await getProductId(superAdminApi, 'e2e-easycla');
      securityProductId = await getProductId(superAdminApi, 'e2e-security');

      // Create a draft on e2e-security (editor has no access to this product)
      const res = await superAdminApi.post('/api/changelogs', {
        data: { productId: securityProductId, title: 'Security Draft (Hidden)', description: 'Should not be visible to editor', version: '0.0.1', status: 'draft' },
      });
      expect(res.status()).toBe(201);
      securityDraftId = (await res.json()).data.id;
    });

    test.afterAll(async () => {
      await superAdminApi.delete(`/api/changelogs/${securityDraftId}`);
    });

    test('super admin sees all entries including drafts from all products', async () => {
      const res = await superAdminApi.get('/api/changelogs');
      const body = await res.json();

      // Original 4 + the security draft we just created
      expect(body.total).toBe(TOTAL_CHANGELOGS + 1);
      const statuses = body.data.map((e: any) => e.status);
      expect(statuses.filter((s: string) => s === 'draft')).toHaveLength(2);
    });

    test('editor listing includes published entries from all products', async () => {
      const res = await editorApi.get('/api/changelogs?status=published');
      expect(res.status()).toBe(200);
      const body = await res.json();

      // All 3 published entries are visible regardless of product
      expect(body.data).toHaveLength(3);
      const productIds = [...new Set(body.data.map((e: any) => e.productId))];
      expect(productIds).toHaveLength(3); // entries from 3 different products
    });

    test('editor listing excludes drafts from products they lack access to', async () => {
      const res = await editorApi.get('/api/changelogs');
      expect(res.status()).toBe(200);
      const body = await res.json();

      // 3 published (all products) + 1 easycla draft = 4, NOT the security draft
      expect(body.total).toBe(TOTAL_CHANGELOGS);
      const drafts = body.data.filter((e: any) => e.status === 'draft');
      expect(drafts).toHaveLength(1);
      expect(drafts[0].productId).toBe(easyclaProductId);
    });

    test('editor listing with status=draft shows only own product drafts', async () => {
      const res = await editorApi.get('/api/changelogs?status=draft');
      expect(res.status()).toBe(200);
      const body = await res.json();

      expect(body.total).toBe(1);
      expect(body.data[0].productId).toBe(easyclaProductId);
    });

    test('editor can GET a draft by ID from their assigned product (200)', async () => {
      // Find the easycla draft
      const listRes = await editorApi.get('/api/changelogs?status=draft');
      const easyclaDraft = (await listRes.json()).data[0];

      const res = await editorApi.get(`/api/changelogs/${easyclaDraft.id}`);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.data.id).toBe(easyclaDraft.id);
    });

    test('editor cannot GET a draft by ID from a product they lack access to (403)', async () => {
      const res = await editorApi.get(`/api/changelogs/${securityDraftId}`);
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('AUTHORIZATION_REQUIRED');
    });

    test('editor can GET a published entry by ID from any product (200)', async () => {
      // Get a published entry from e2e-security (editor has no write access, but read is allowed)
      const listRes = await superAdminApi.get('/api/changelogs?status=published');
      const securityPublished = (await listRes.json()).data.find((e: any) => e.productId === securityProductId);

      const res = await editorApi.get(`/api/changelogs/${securityPublished.id}`);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.data.id).toBe(securityPublished.id);
    });
  });
});
