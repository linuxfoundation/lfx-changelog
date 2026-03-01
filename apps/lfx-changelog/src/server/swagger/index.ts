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

// Register security schemes
registry.registerComponent('securitySchemes', 'apiKeyAuth', {
  type: 'http',
  scheme: 'bearer',
  description: 'API key authentication. Use a key with the `lfx_` prefix as the Bearer token.',
});

registry.registerComponent('securitySchemes', 'cookieAuth', {
  type: 'apiKey',
  in: 'cookie',
  name: 'appSession',
  description: 'Browser session authentication via Auth0 (OAuth login required). Not available for programmatic API key access.',
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
      'Protected endpoints require an API key. Click the **Authorize** button and enter your key (with the `lfx_` prefix).\n\n' +
      'Manage keys in the Admin panel under API Keys.\n\n' +
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

const CUSTOM_CSS = '.swagger-ui .topbar { display: none }';

export function setupSwagger(): Router {
  const router = Router();

  router.use('/', swaggerUi.serve);
  router.get(
    '/',
    swaggerUi.setup(document, {
      customCss: CUSTOM_CSS,
      customSiteTitle: 'LFX Changelog API Docs',
    })
  );
  return router;
}
