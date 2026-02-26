// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { UserRole } from '../enums/user-role.enum.js';
import type { User } from '../interfaces/user.interface.js';

export const MOCK_USERS: User[] = [
  {
    id: 'user-001',
    auth0Id: 'auth0|superadmin001',
    email: 'admin@linuxfoundation.org',
    name: 'Sarah Chen',
    avatarUrl: 'https://i.pravatar.cc/150?u=sarah-chen',
    createdAt: '2024-01-10T08:00:00.000Z',
    updatedAt: '2024-06-15T12:00:00.000Z',
    roles: [
      {
        id: 'role-001',
        userId: 'user-001',
        productId: null,
        role: UserRole.SUPER_ADMIN,
      },
    ],
  },
  {
    id: 'user-002',
    auth0Id: 'auth0|prodadmin001',
    email: 'james.wilson@linuxfoundation.org',
    name: 'James Wilson',
    avatarUrl: 'https://i.pravatar.cc/150?u=james-wilson',
    createdAt: '2024-02-05T10:30:00.000Z',
    updatedAt: '2024-07-20T09:00:00.000Z',
    roles: [
      {
        id: 'role-002',
        userId: 'user-002',
        productId: 'prod-easycla',
        role: UserRole.PRODUCT_ADMIN,
      },
      {
        id: 'role-003',
        userId: 'user-002',
        productId: 'prod-insights',
        role: UserRole.PRODUCT_ADMIN,
      },
    ],
  },
  {
    id: 'user-003',
    auth0Id: 'auth0|editor001',
    email: 'maria.garcia@linuxfoundation.org',
    name: 'Maria Garcia',
    avatarUrl: 'https://i.pravatar.cc/150?u=maria-garcia',
    createdAt: '2024-03-12T14:15:00.000Z',
    updatedAt: '2024-08-10T16:30:00.000Z',
    roles: [
      {
        id: 'role-004',
        userId: 'user-003',
        productId: 'prod-security',
        role: UserRole.EDITOR,
      },
      {
        id: 'role-005',
        userId: 'user-003',
        productId: 'prod-mentorship',
        role: UserRole.EDITOR,
      },
    ],
  },
  {
    id: 'user-004',
    auth0Id: 'auth0|prodadmin002',
    email: 'alex.kumar@linuxfoundation.org',
    name: 'Alex Kumar',
    avatarUrl: 'https://i.pravatar.cc/150?u=alex-kumar',
    createdAt: '2024-01-20T09:00:00.000Z',
    updatedAt: '2024-05-28T11:45:00.000Z',
    roles: [
      {
        id: 'role-006',
        userId: 'user-004',
        productId: 'prod-crowdfunding',
        role: UserRole.PRODUCT_ADMIN,
      },
    ],
  },
  {
    id: 'user-005',
    auth0Id: 'auth0|editor002',
    email: 'emily.zhang@linuxfoundation.org',
    name: 'Emily Zhang',
    avatarUrl: 'https://i.pravatar.cc/150?u=emily-zhang',
    createdAt: '2024-04-01T11:00:00.000Z',
    updatedAt: '2024-09-05T14:20:00.000Z',
    roles: [
      {
        id: 'role-007',
        userId: 'user-005',
        productId: 'prod-pcc',
        role: UserRole.EDITOR,
      },
      {
        id: 'role-008',
        userId: 'user-005',
        productId: 'prod-org-dashboard',
        role: UserRole.EDITOR,
      },
    ],
  },
  {
    id: 'user-006',
    auth0Id: 'auth0|editor003',
    email: 'david.okafor@linuxfoundation.org',
    name: 'David Okafor',
    avatarUrl: 'https://i.pravatar.cc/150?u=david-okafor',
    createdAt: '2024-05-10T13:30:00.000Z',
    updatedAt: '2024-09-18T10:00:00.000Z',
    roles: [
      {
        id: 'role-009',
        userId: 'user-006',
        productId: 'prod-insights',
        role: UserRole.EDITOR,
      },
    ],
  },
];
