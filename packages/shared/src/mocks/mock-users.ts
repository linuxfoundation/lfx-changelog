// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { UserRole } from '../enums/user-role.enum.js';
import type { User } from '../schemas/user.schema.js';
import { PRODUCT_IDS, ROLE_IDS, USER_IDS, USER_PERSONAS } from './mock-seed.js';

export const MOCK_USERS: User[] = [
  {
    id: USER_IDS.SUPER_ADMIN,
    auth0Id: USER_PERSONAS.SUPER_ADMIN.auth0Id,
    email: USER_PERSONAS.SUPER_ADMIN.email,
    name: USER_PERSONAS.SUPER_ADMIN.name,
    avatarUrl: USER_PERSONAS.SUPER_ADMIN.avatarUrl,
    createdAt: '2024-01-10T08:00:00.000Z',
    updatedAt: '2024-06-15T12:00:00.000Z',
    roles: [
      {
        id: ROLE_IDS[0]!,
        userId: USER_IDS.SUPER_ADMIN,
        productId: null,
        role: UserRole.SUPER_ADMIN,
      },
    ],
  },
  {
    id: USER_IDS.PRODUCT_ADMIN_1,
    auth0Id: USER_PERSONAS.PRODUCT_ADMIN_1.auth0Id,
    email: USER_PERSONAS.PRODUCT_ADMIN_1.email,
    name: USER_PERSONAS.PRODUCT_ADMIN_1.name,
    avatarUrl: USER_PERSONAS.PRODUCT_ADMIN_1.avatarUrl,
    createdAt: '2024-02-05T10:30:00.000Z',
    updatedAt: '2024-07-20T09:00:00.000Z',
    roles: [
      {
        id: ROLE_IDS[1]!,
        userId: USER_IDS.PRODUCT_ADMIN_1,
        productId: PRODUCT_IDS.EASYCLA,
        role: UserRole.PRODUCT_ADMIN,
      },
      {
        id: ROLE_IDS[2]!,
        userId: USER_IDS.PRODUCT_ADMIN_1,
        productId: PRODUCT_IDS.INSIGHTS,
        role: UserRole.PRODUCT_ADMIN,
      },
    ],
  },
  {
    id: USER_IDS.EDITOR_1,
    auth0Id: USER_PERSONAS.EDITOR_1.auth0Id,
    email: USER_PERSONAS.EDITOR_1.email,
    name: USER_PERSONAS.EDITOR_1.name,
    avatarUrl: USER_PERSONAS.EDITOR_1.avatarUrl,
    createdAt: '2024-03-12T14:15:00.000Z',
    updatedAt: '2024-08-10T16:30:00.000Z',
    roles: [
      {
        id: ROLE_IDS[3]!,
        userId: USER_IDS.EDITOR_1,
        productId: PRODUCT_IDS.SECURITY,
        role: UserRole.EDITOR,
      },
      {
        id: ROLE_IDS[4]!,
        userId: USER_IDS.EDITOR_1,
        productId: PRODUCT_IDS.MENTORSHIP,
        role: UserRole.EDITOR,
      },
    ],
  },
  {
    id: USER_IDS.PRODUCT_ADMIN_2,
    auth0Id: USER_PERSONAS.PRODUCT_ADMIN_2.auth0Id,
    email: USER_PERSONAS.PRODUCT_ADMIN_2.email,
    name: USER_PERSONAS.PRODUCT_ADMIN_2.name,
    avatarUrl: USER_PERSONAS.PRODUCT_ADMIN_2.avatarUrl,
    createdAt: '2024-01-20T09:00:00.000Z',
    updatedAt: '2024-05-28T11:45:00.000Z',
    roles: [
      {
        id: ROLE_IDS[5]!,
        userId: USER_IDS.PRODUCT_ADMIN_2,
        productId: PRODUCT_IDS.CROWDFUNDING,
        role: UserRole.PRODUCT_ADMIN,
      },
    ],
  },
  {
    id: USER_IDS.EDITOR_2,
    auth0Id: USER_PERSONAS.EDITOR_2.auth0Id,
    email: USER_PERSONAS.EDITOR_2.email,
    name: USER_PERSONAS.EDITOR_2.name,
    avatarUrl: USER_PERSONAS.EDITOR_2.avatarUrl,
    createdAt: '2024-04-01T11:00:00.000Z',
    updatedAt: '2024-09-05T14:20:00.000Z',
    roles: [
      {
        id: ROLE_IDS[6]!,
        userId: USER_IDS.EDITOR_2,
        productId: PRODUCT_IDS.PCC,
        role: UserRole.EDITOR,
      },
      {
        id: ROLE_IDS[7]!,
        userId: USER_IDS.EDITOR_2,
        productId: PRODUCT_IDS.ORG_DASHBOARD,
        role: UserRole.EDITOR,
      },
    ],
  },
  {
    id: USER_IDS.EDITOR_3,
    auth0Id: USER_PERSONAS.EDITOR_3.auth0Id,
    email: USER_PERSONAS.EDITOR_3.email,
    name: USER_PERSONAS.EDITOR_3.name,
    avatarUrl: USER_PERSONAS.EDITOR_3.avatarUrl,
    createdAt: '2024-05-10T13:30:00.000Z',
    updatedAt: '2024-09-18T10:00:00.000Z',
    roles: [
      {
        id: ROLE_IDS[8]!,
        userId: USER_IDS.EDITOR_3,
        productId: PRODUCT_IDS.INSIGHTS,
        role: UserRole.EDITOR,
      },
    ],
  },
];
