// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { expect, test } from '@playwright/test';

import { createUnauthenticatedContext } from '../../helpers/api.helper.js';

import type { APIRequestContext } from '@playwright/test';

/**
 * What traefik puts in front of this app in the cluster. Angular keeps its own proxy-header
 * allowlist, separate from Express's `trust proxy`, and since @angular/ssr 20.3.37 an untrusted
 * one makes it serve the client shell instead of rendering — silently, apart from a warning.
 *
 * That shipped to production once: the page arrived with an empty root, so the injected auth
 * context and runtime config never reached the browser, which read as "login does nothing" and
 * "Datadog id is not available".
 */
const TRAEFIK_HEADERS = {
  'x-forwarded-for': '203.0.113.7',
  'x-forwarded-port': '443',
  'x-forwarded-server': 'traefik-abc123',
};

/** Angular marks the client-only shell with `ngcm` on the body and leaves the root empty. */
function describeRender(html: string): { rendered: number; clientShell: boolean } {
  const root = /<lfx-root[^>]*>([\s\S]*?)<\/lfx-root>/.exec(html);
  return { rendered: root ? root[1].trim().length : -1, clientShell: /<body[^>]*\sngcm(=|\s|>)/.test(html) };
}

test.describe('Server-side rendering', () => {
  let api: APIRequestContext;

  test.beforeAll(async ({}, testInfo) => {
    api = await createUnauthenticatedContext(testInfo.project.use.baseURL as string);
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test('renders the page on the server', async () => {
    const { rendered, clientShell } = describeRender(await (await api.get('/')).text());

    expect(clientShell, 'the client shell means nothing was rendered').toBe(false);
    expect(rendered).toBeGreaterThan(0);
  });

  test('a proxy header outside the allowlist is enough to lose the render', async () => {
    // Guards the brittleness of an exact-match allowlist: if the proxy ever adds a header the
    // engine does not trust, rendering stops with nothing but a warning. This asserts the
    // failure mode exists so it is a decision on record rather than a surprise.
    const { clientShell } = describeRender(await (await api.get('/', { headers: { 'x-forwarded-prefix': '/x' } })).text());

    expect(clientShell, 'an untrusted proxy header still forces the client shell').toBe(true);
  });

  test('still renders behind the proxy headers traefik adds', async () => {
    // The regression: any one of these being untrusted is enough to lose the render.
    const { rendered, clientShell } = describeRender(await (await api.get('/', { headers: TRAEFIK_HEADERS })).text());

    expect(clientShell, 'proxy headers must not force the client shell').toBe(false);
    expect(rendered).toBeGreaterThan(0);
  });
});
