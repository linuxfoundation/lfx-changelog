// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import {
  AssignRoleRequestSchema,
  CreateUserRequestSchema,
  UpdateUserRequestSchema,
  UserRoleAssignmentSchema,
  UserSchema,
  createApiResponseSchema,
} from '@lfx-changelog/shared';

import { COOKIE_AUTH } from '../constants';

export const userRegistry = new OpenAPIRegistry();

userRegistry.registerPath({
  method: 'get',
  path: '/api/users/me',
  tags: ['Users'],
  summary: 'Get current user',
  description: 'Returns the currently authenticated user with their roles.\n\n**Required privilege:** Any authenticated user.',
  security: COOKIE_AUTH,
  responses: {
    200: {
      description: 'Current user',
      content: {
        'application/json': {
          schema: createApiResponseSchema(UserSchema),
        },
      },
    },
    401: { description: 'Unauthorized' },
  },
});

userRegistry.registerPath({
  method: 'get',
  path: '/api/users',
  tags: ['Users'],
  summary: 'List all users',
  description: 'Returns all users.\n\n**Required privilege:** SUPER_ADMIN role.',
  security: COOKIE_AUTH,
  responses: {
    200: {
      description: 'List of users',
      content: {
        'application/json': {
          schema: createApiResponseSchema(z.array(UserSchema)),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires SUPER_ADMIN role' },
  },
});

userRegistry.registerPath({
  method: 'post',
  path: '/api/users',
  tags: ['Users'],
  summary: 'Create a new user',
  description: 'Creates a new user and assigns a role.\n\n**Required privilege:** SUPER_ADMIN role.',
  security: COOKIE_AUTH,
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateUserRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'User created',
      content: {
        'application/json': {
          schema: createApiResponseSchema(UserSchema),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires SUPER_ADMIN role' },
    409: { description: 'Conflict — user with this email already exists' },
  },
});

userRegistry.registerPath({
  method: 'post',
  path: '/api/users/{id}/roles',
  tags: ['Users'],
  summary: 'Assign role to user',
  description: 'Assigns a role to a user.\n\n**Required privilege:** PRODUCT_ADMIN role or above.',
  security: COOKIE_AUTH,
  request: {
    params: z.object({
      id: z.string().openapi({ description: 'User ID' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: AssignRoleRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Role assigned',
      content: {
        'application/json': {
          schema: createApiResponseSchema(UserRoleAssignmentSchema),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires PRODUCT_ADMIN role or above' },
    404: { description: 'User not found' },
  },
});

userRegistry.registerPath({
  method: 'delete',
  path: '/api/users/{id}/roles/{roleId}',
  tags: ['Users'],
  summary: 'Remove role from user',
  description: 'Removes a role assignment from a user.\n\n**Required privilege:** PRODUCT_ADMIN role or above.',
  security: COOKIE_AUTH,
  request: {
    params: z.object({
      id: z.string().openapi({ description: 'User ID' }),
      roleId: z.string().openapi({ description: 'Role assignment ID' }),
    }),
  },
  responses: {
    204: { description: 'Role removed' },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires PRODUCT_ADMIN role or above' },
    404: { description: 'User or role assignment not found' },
  },
});

userRegistry.registerPath({
  method: 'post',
  path: '/api/users/{id}/deactivate',
  tags: ['Users'],
  summary: 'Deactivate a user',
  description:
    "Removes all of the user's role assignments, revokes their API keys, and marks them deactivated so they no longer resolve as a signed-in user. Authored content is untouched. Idempotent.\n\n**Required privilege:** SUPER_ADMIN role. Callers cannot deactivate themselves, the automation bot, or the last Super Admin.",
  security: COOKIE_AUTH,
  request: {
    params: z.object({
      id: z.string().openapi({ description: 'User ID' }),
    }),
  },
  responses: {
    200: {
      description: 'User deactivated',
      content: {
        'application/json': {
          schema: createApiResponseSchema(UserSchema),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires SUPER_ADMIN role, or caller is the target' },
    404: { description: 'User not found' },
    409: { description: 'Conflict — last Super Admin, automation bot, or a concurrent change' },
  },
});

userRegistry.registerPath({
  method: 'post',
  path: '/api/users/{id}/reactivate',
  tags: ['Users'],
  summary: 'Reactivate a user',
  description:
    'Clears the deactivated flag so the user can sign in again. No roles or API keys are restored; assign roles afterwards. Idempotent.\n\n**Required privilege:** SUPER_ADMIN role.',
  security: COOKIE_AUTH,
  request: {
    params: z.object({
      id: z.string().openapi({ description: 'User ID' }),
    }),
  },
  responses: {
    200: {
      description: 'User reactivated',
      content: {
        'application/json': {
          schema: createApiResponseSchema(UserSchema),
        },
      },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires SUPER_ADMIN role' },
    404: { description: 'User not found' },
  },
});

userRegistry.registerPath({
  method: 'patch',
  path: '/api/users/{id}',
  tags: ['Users'],
  summary: 'Update a user',
  description:
    "Updates a user's name and/or email. Sign-in is matched by email, so after an email change the person must sign in with the new address.\n\n**Required privilege:** SUPER_ADMIN role. Callers cannot change their own email, and the automation bot's email cannot be changed.",
  security: COOKIE_AUTH,
  request: {
    params: z.object({
      id: z.string().openapi({ description: 'User ID' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateUserRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'User updated',
      content: {
        'application/json': {
          schema: createApiResponseSchema(UserSchema),
        },
      },
    },
    400: { description: 'Validation error' },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden — requires SUPER_ADMIN role, or caller is changing their own email' },
    404: { description: 'User not found' },
    409: { description: 'Conflict — email already in use, or the automation bot email' },
  },
});
