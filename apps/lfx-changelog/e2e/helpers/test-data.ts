// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { ChangelogStatus, CreateChangelogEntryRequestSchema, UserRole, UserRoleAssignmentSchema, UserSchema } from '@lfx-changelog/shared';
import { z } from 'zod';

import type { CreateProductRequest } from '@lfx-changelog/shared';

const TestUserSchema = UserSchema.pick({ auth0Id: true, email: true, name: true }).extend({
  role: z.union([UserRoleAssignmentSchema.shape.role, z.literal('user')]),
});

const TestRoleAssignmentSchema = UserRoleAssignmentSchema.pick({ role: true }).extend({
  userIndex: z.number(),
  productSlug: z.string(),
});

const TestChangelogSchema = CreateChangelogEntryRequestSchema.pick({ title: true, description: true, version: true, status: true }).extend({
  productSlug: z.string(),
  authorIndex: z.number(),
  publishedAt: z.date().optional(),
});

type TestUser = z.infer<typeof TestUserSchema>;
type TestRoleAssignment = z.infer<typeof TestRoleAssignmentSchema>;
type TestChangelog = z.infer<typeof TestChangelogSchema>;

function auth0Id(role: string): string {
  return `auth0|${process.env[`E2E_${role}_USERNAME`] || 'REPLACE_ME'}`;
}

export const TEST_USERS: TestUser[] = [
  {
    auth0Id: auth0Id('SUPER_ADMIN'),
    email: 'test+changelog_super_admin@example.com',
    name: 'E2E Super Admin',
    role: UserRole.SUPER_ADMIN,
  },
  {
    auth0Id: auth0Id('PRODUCT_ADMIN'),
    email: 'test+changelog_product_admin@example.com',
    name: 'E2E Product Admin',
    role: UserRole.PRODUCT_ADMIN,
  },
  {
    auth0Id: auth0Id('EDITOR'),
    email: 'test+changelog_editor@example.com',
    name: 'E2E Editor',
    role: UserRole.EDITOR,
  },
  {
    auth0Id: auth0Id('USER'),
    email: 'test+changelog_user@example.com',
    name: 'E2E User',
    role: 'user',
  },
];

export const TEST_PRODUCTS: CreateProductRequest[] = [
  {
    name: 'E2E EasyCLA',
    slug: 'e2e-easycla',
    description: 'E2E test product for EasyCLA',
    faIcon: 'fa-duotone fa-file-contract',
  },
  {
    name: 'E2E Security',
    slug: 'e2e-security',
    description: 'E2E test product for Security',
    faIcon: 'fa-duotone fa-shield-halved',
  },
  {
    name: 'E2E Insights',
    slug: 'e2e-insights',
    description: 'E2E test product for Insights',
    faIcon: 'fa-duotone fa-chart-mixed',
  },
];

export const TEST_ROLE_ASSIGNMENTS: TestRoleAssignment[] = [
  { userIndex: 1, productSlug: 'e2e-easycla', role: UserRole.PRODUCT_ADMIN },
  { userIndex: 2, productSlug: 'e2e-easycla', role: UserRole.EDITOR },
];

export const TEST_CHANGELOGS: TestChangelog[] = [
  {
    title: 'E2E: Added new CLA signature flow',
    description:
      '## New Feature\n\nAdded a streamlined CLA signature flow for contributors.\n\n- One-click signing\n- GitHub integration\n- Email notifications',
    version: '2.1.0',
    status: ChangelogStatus.PUBLISHED,
    productSlug: 'e2e-easycla',
    authorIndex: 0,
    publishedAt: new Date('2026-01-15T10:00:00Z'),
  },
  {
    title: 'E2E: Security vulnerability scanning improvements',
    description:
      '## Improvement\n\nEnhanced vulnerability scanning with faster detection and reduced false positives.\n\n- Improved SAST rules\n- New dependency check engine',
    version: '3.0.1',
    status: ChangelogStatus.PUBLISHED,
    productSlug: 'e2e-security',
    authorIndex: 0,
    publishedAt: new Date('2026-02-01T14:30:00Z'),
  },
  {
    title: 'E2E: Insights dashboard redesign',
    description:
      '## Redesign\n\nCompletely revamped the Insights dashboard with new charts and filters.\n\n- Interactive time-series charts\n- Custom date ranges\n- Export to CSV',
    version: '1.5.0',
    status: ChangelogStatus.PUBLISHED,
    productSlug: 'e2e-insights',
    authorIndex: 0,
    publishedAt: new Date('2026-02-10T09:00:00Z'),
  },
  {
    title: 'E2E: Draft - Upcoming CLA improvements',
    description: '## Upcoming\n\nDraft notes for the next CLA release.\n\n- Bulk signing support\n- LDAP integration',
    version: '2.2.0',
    status: ChangelogStatus.DRAFT,
    productSlug: 'e2e-easycla',
    authorIndex: 0,
    publishedAt: undefined,
  },
];
