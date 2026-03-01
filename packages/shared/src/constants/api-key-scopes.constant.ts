// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { ApiKeyScope } from '../enums/api-key-scope.enum.js';
import { UserRole } from '../enums/user-role.enum.js';

import type { ApiKeyScopeMetadata } from '../schemas/api-key.schema.js';

export const API_KEY_SCOPES: ApiKeyScopeMetadata[] = [
  {
    scope: ApiKeyScope.CHANGELOGS_READ,
    label: 'Read Changelogs',
    description: 'Read changelog entries and their details',
    resource: 'changelogs',
    action: 'read',
    color: '#3B82F6',
    minimumRole: UserRole.EDITOR,
  },
  {
    scope: ApiKeyScope.CHANGELOGS_WRITE,
    label: 'Write Changelogs',
    description: 'Create, update, publish, and delete changelog entries',
    resource: 'changelogs',
    action: 'write',
    color: '#8B5CF6',
    minimumRole: UserRole.EDITOR,
  },
  {
    scope: ApiKeyScope.PRODUCTS_READ,
    label: 'Read Products',
    description: 'Read product listings and their details',
    resource: 'products',
    action: 'read',
    color: '#10B981',
    minimumRole: UserRole.EDITOR,
  },
  {
    scope: ApiKeyScope.PRODUCTS_WRITE,
    label: 'Write Products',
    description: 'Create, update, and delete products',
    resource: 'products',
    action: 'write',
    color: '#F59E0B',
    minimumRole: UserRole.SUPER_ADMIN,
  },
];

/** Expiration preset options (in days) for API key creation UI. */
export const API_KEY_EXPIRATION_OPTIONS = [
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '180 days' },
  { value: '365', label: '365 days' },
];
