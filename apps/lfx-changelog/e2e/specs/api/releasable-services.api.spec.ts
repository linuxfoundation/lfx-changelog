// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';
import { createApiKeyContext, createAuthenticatedContext, createUnauthenticatedContext } from '../../helpers/api.helper.js';
import { TEST_RELEASABLE_SERVICES } from '../../helpers/test-data.js';

import type { APIRequestContext } from '@playwright/test';

/** Selected by what each fixture is for, so a missing one fails here by name rather than by index. */
function fixtureName(predicate: (service: (typeof TEST_RELEASABLE_SERVICES)[number]) => boolean, description: string): string {
  const match = TEST_RELEASABLE_SERVICES.find(predicate);
  if (!match) throw new Error(`Fixture missing: ${description}. Check TEST_RELEASABLE_SERVICES in test-data.ts.`);
  return match.displayName;
}

const OWNED = fixtureName((s) => s.repository === 'primary' && s.isActive !== false, 'an active service on the tracked repository');
const FOREIGN = fixtureName((s) => s.repository === 'foreign', 'a service on the out-of-product repository');
const INACTIVE = fixtureName((s) => s.isActive === false, 'an inactive service');

type ServiceRow = {
  displayName: string;
  deploymentType: string;
  appName: string | null;
  latestTag: string | null;
  repositoryFullName: string;
  productName: string;
};

test.describe('Releasable services API (/api/releases/services)', () => {
  let unauthApi: APIRequestContext;
  let superAdminApi: APIRequestContext;
  let productAdminApi: APIRequestContext;
  let editorApi: APIRequestContext;

  async function listAs(api: APIRequestContext): Promise<ServiceRow[]> {
    const res = await api.get('/api/releases/services');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    return body.data as ServiceRow[];
  }

  test.beforeAll(async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    unauthApi = await createUnauthenticatedContext(baseURL);
    superAdminApi = await createAuthenticatedContext('super_admin', baseURL);
    productAdminApi = await createAuthenticatedContext('product_admin', baseURL);
    editorApi = await createAuthenticatedContext('editor', baseURL);
  });

  test.afterAll(async () => {
    await Promise.all([unauthApi.dispose(), superAdminApi.dispose(), productAdminApi.dispose(), editorApi.dispose()]);
  });

  test.describe('Authentication (401)', () => {
    test('GET /api/releases/services returns 401 without auth', async () => {
      const res = await unauthApi.get('/api/releases/services');
      expect(res.status()).toBe(401);
      expect((await res.json()).code).toBe('AUTHENTICATION_REQUIRED');
    });
  });

  test.describe('Authorization (403)', () => {
    test('API key auth is rejected on this session-only endpoint', async ({}, testInfo) => {
      const baseURL = testInfo.project.use.baseURL as string;
      const createRes = await superAdminApi.post('/api/api-keys', {
        data: { name: 'releasable-services-oauth-only', scopes: ['products:read'], expiresInDays: 30 },
      });
      expect(createRes.status()).toBe(201);
      const { rawKey, apiKey } = (await createRes.json()).data;

      const apiKeyCtx = await createApiKeyContext(rawKey, baseURL);
      try {
        const res = await apiKeyCtx.get('/api/releases/services');
        expect(res.status()).toBe(403);
        expect((await res.json()).code).toBe('AUTHORIZATION_REQUIRED');
      } finally {
        await apiKeyCtx.dispose();
        await superAdminApi.delete(`/api/api-keys/${apiKey.id}`);
      }
    });

    test('an editor cannot list releasable services', async () => {
      const res = await editorApi.get('/api/releases/services');
      expect(res.status()).toBe(403);
    });
  });

  test.describe('Permission filtering', () => {
    test('a super admin sees services across every product', async () => {
      const names = (await listAs(superAdminApi)).map((service) => service.displayName);

      expect(names).toContain(OWNED);
      expect(names).toContain(FOREIGN);
    });

    test("a product admin sees only its own product's services", async () => {
      const names = (await listAs(productAdminApi)).map((service) => service.displayName);

      expect(names).toContain(OWNED);
      // Omitted rather than refused — the list must not reveal what it cannot release.
      expect(names).not.toContain(FOREIGN);
    });

    test('an inactive service is listed for nobody', async () => {
      const names = (await listAs(superAdminApi)).map((service) => service.displayName);

      expect(names).not.toContain(INACTIVE);
    });
  });

  test.describe('Service detail', () => {
    test('carries the deployment target, repository and newest stored tag', async () => {
      const services = await listAs(superAdminApi);

      const owned = services.find((service) => service.displayName === OWNED);
      expect(owned, `seeded service ${OWNED} is missing`).toBeDefined();
      expect(owned!.deploymentType).toBe('standalone');
      expect(owned!.appName).toBe('e2e-easycla-repo');
      expect(owned!.repositoryFullName).toBe('linuxfoundation/e2e-easycla-repo');
      expect(owned!.productName).toBeTruthy();
      // Drafts are excluded, so this is the newest published tag on that repository.
      expect(owned!.latestTag).toBe('v1.2.0-rc.1');
    });

    test('a platform subchart has no Argo CD application of its own', async () => {
      const services = await listAs(superAdminApi);

      const foreign = services.find((service) => service.displayName === FOREIGN);
      expect(foreign, `seeded service ${FOREIGN} is missing`).toBeDefined();
      expect(foreign!.deploymentType).toBe('platform_subchart');
      expect(foreign!.appName).toBeNull();
    });
  });
});
