// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { ReleasableServiceSchema, createApiResponseSchema } from '@lfx-changelog/shared';
import { z } from 'zod';

import { COOKIE_AUTH } from '../constants';

export const releasableServiceRegistry = new OpenAPIRegistry();

releasableServiceRegistry.registerPath({
  method: 'get',
  path: '/api/releases/services',
  tags: ['Releasable Services'],
  summary: 'List services the caller may release',
  description:
    "Returns the active releasable services whose repository belongs to a product the caller administers, each with its deployment target and the newest tag stored for it.\n\nA super admin sees every service. Services outside the caller's products are omitted rather than refused, so the list cannot be used to discover them. Inactive services are never listed.\n\n**Required privilege:** PRODUCT_ADMIN. Session authentication only.",
  security: COOKIE_AUTH,
  responses: {
    200: {
      description: 'Releasable services',
      content: { 'application/json': { schema: createApiResponseSchema(z.array(ReleasableServiceSchema)) } },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires PRODUCT_ADMIN, or an API key was used' },
  },
});
