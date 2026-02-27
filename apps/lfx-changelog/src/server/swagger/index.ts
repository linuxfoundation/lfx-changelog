// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

// Import schemas to trigger .openapi() registration
import '@lfx-changelog/shared';

import { changelogRegistry } from './paths/changelogs.path';
import { productRegistry } from './paths/products.path';
import { publicChangelogRegistry } from './paths/public-changelogs.path';
import { publicProductRegistry } from './paths/public-products.path';
import { userRegistry } from './paths/users.path';

const registry = new OpenAPIRegistry();

// Register security scheme (cookie-based — Auth0 session)
registry.registerComponent('securitySchemes', 'cookieAuth', {
  type: 'apiKey',
  in: 'cookie',
  name: 'appSession',
  description: 'Auth0 session cookie set after login. Protected endpoints require this cookie to be present.',
});

// Merge all path registries
const allRegistries = [publicProductRegistry, publicChangelogRegistry, productRegistry, changelogRegistry, userRegistry];

// Collect all definitions from all registries
const allDefinitions = [...registry.definitions, ...allRegistries.flatMap((r) => r.definitions)];

const generator = new OpenApiGeneratorV31(allDefinitions);
const document = generator.generateDocument({
  openapi: '3.1.0',
  info: {
    title: 'LFX Changelog API',
    version: '1.0.0',
    description:
      'API for managing LFX product changelogs, products, and users.\n\n' +
      '### Authentication\n\n' +
      'This API uses **cookie-based authentication** via Auth0. ' +
      'To authenticate, [login with Auth0](/login?returnTo=/docs) — your session cookie will be sent automatically with all requests made from this page.\n\n' +
      'Public endpoints (under *Public* tags) do not require authentication.',
  },
  servers: [{ url: '/', description: 'Current server' }],
  tags: [
    { name: 'Public - Products', description: 'No authentication required' },
    { name: 'Public - Changelogs', description: 'No authentication required' },
    { name: 'Products', description: 'Authentication required' },
    { name: 'Changelogs', description: 'Authentication required' },
    { name: 'Users', description: 'Authentication required' },
  ],
});

const CUSTOM_CSS = [
  '.swagger-ui .topbar { display: none }',
  '.swagger-ui .auth-wrapper .authorize { display: none }',
  '.auth-banner { padding: 12px 16px; border-radius: 8px; margin-top: 16px; font-size: 14px; line-height: 1.6; }',
  '.auth-banner.logged-in { background: #e8f5e9; color: #1b5e20; border: 1px solid #a5d6a7; }',
  '.auth-banner.logged-out { background: #fff3e0; color: #e65100; border: 1px solid #ffcc80; }',
  '.auth-banner a { color: inherit; font-weight: 600; text-decoration: underline; }',
].join('\n');

// Uses safe DOM methods (textContent + createElement) instead of innerHTML to avoid XSS
const CUSTOM_JS = `
window.addEventListener('load', async function() {
  function createLink(text, href) {
    var a = document.createElement('a');
    a.textContent = text;
    a.href = href;
    return a;
  }

  try {
    var res = await fetch('/api/users/me', { credentials: 'include' });
    var banner = document.createElement('div');
    banner.className = 'auth-banner';

    if (res.ok) {
      var data = await res.json();
      var name = data.data && (data.data.name || data.data.email) || 'User';
      banner.className += ' logged-in';
      var strong = document.createElement('strong');
      strong.textContent = 'Authenticated';
      banner.appendChild(strong);
      banner.appendChild(document.createTextNode(' as ' + name + '. Session cookie is active. '));
      banner.appendChild(createLink('Logout', '/logout'));
    } else if (res.status === 403) {
      banner.className += ' logged-out';
      var strong = document.createElement('strong');
      strong.textContent = 'Authenticated';
      banner.appendChild(strong);
      banner.appendChild(document.createTextNode(' but your account lacks the required role. Contact an administrator for access.'));
    } else {
      banner.className += ' logged-out';
      banner.appendChild(document.createTextNode('Not authenticated. '));
      banner.appendChild(createLink('Login with Auth0', '/login?returnTo=/docs'));
      banner.appendChild(document.createTextNode(' to access protected endpoints.'));
    }

    var info = document.querySelector('.swagger-ui .information-container');
    if (info) info.appendChild(banner);
  } catch (e) {}
});
`;

export function setupSwagger(): Router {
  const router = Router();

  // Serve auth-check script as a static JS file (customJs requires a URL, not inline code)
  router.get('/auth-check.js', (_req, res) => {
    res.type('application/javascript').send(CUSTOM_JS);
  });

  router.use('/', swaggerUi.serve);
  router.get(
    '/',
    swaggerUi.setup(document, {
      customCss: CUSTOM_CSS,
      customJs: '/docs/auth-check.js',
      customSiteTitle: 'LFX Changelog API Docs',
    })
  );
  return router;
}
