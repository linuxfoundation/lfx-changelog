// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

export const TEST_USERS = [
  {
    auth0Id: process.env['E2E_SUPER_ADMIN_AUTH0_ID'] || 'auth0|REPLACE_ME',
    email: process.env['E2E_SUPER_ADMIN_EMAIL'] || 'test+changelog_super_admin@example.com',
    name: 'E2E Super Admin',
    role: 'super_admin' as const,
  },
  {
    auth0Id: process.env['E2E_PRODUCT_ADMIN_AUTH0_ID'] || 'auth0|REPLACE_ME',
    email: process.env['E2E_PRODUCT_ADMIN_EMAIL'] || 'test+changelog_product_admin@example.com',
    name: 'E2E Product Admin',
    role: 'product_admin' as const,
  },
  {
    auth0Id: process.env['E2E_EDITOR_AUTH0_ID'] || 'auth0|REPLACE_ME',
    email: process.env['E2E_EDITOR_EMAIL'] || 'test+changelog_editor@example.com',
    name: 'E2E Editor',
    role: 'editor' as const,
  },
  {
    auth0Id: process.env['E2E_USER_AUTH0_ID'] || 'auth0|REPLACE_ME',
    email: process.env['E2E_USER_EMAIL'] || 'test+changelog_user@example.com',
    name: 'E2E User',
    role: 'user' as const,
  },
];

export const TEST_PRODUCTS = [
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

export const TEST_ROLE_ASSIGNMENTS = [
  { userIndex: 1, productSlug: 'e2e-easycla', role: 'product_admin' as const },
  { userIndex: 2, productSlug: 'e2e-easycla', role: 'editor' as const },
];

export const TEST_CHANGELOGS = [
  {
    title: 'E2E: Added new CLA signature flow',
    description:
      '## New Feature\n\nAdded a streamlined CLA signature flow for contributors.\n\n- One-click signing\n- GitHub integration\n- Email notifications',
    version: '2.1.0',
    status: 'published' as const,
    productSlug: 'e2e-easycla',
    authorIndex: 0,
    publishedAt: new Date('2026-01-15T10:00:00Z'),
  },
  {
    title: 'E2E: Security vulnerability scanning improvements',
    description:
      '## Improvement\n\nEnhanced vulnerability scanning with faster detection and reduced false positives.\n\n- Improved SAST rules\n- New dependency check engine',
    version: '3.0.1',
    status: 'published' as const,
    productSlug: 'e2e-security',
    authorIndex: 0,
    publishedAt: new Date('2026-02-01T14:30:00Z'),
  },
  {
    title: 'E2E: Insights dashboard redesign',
    description:
      '## Redesign\n\nCompletely revamped the Insights dashboard with new charts and filters.\n\n- Interactive time-series charts\n- Custom date ranges\n- Export to CSV',
    version: '1.5.0',
    status: 'published' as const,
    productSlug: 'e2e-insights',
    authorIndex: 0,
    publishedAt: new Date('2026-02-10T09:00:00Z'),
  },
  {
    title: 'E2E: Draft - Upcoming CLA improvements',
    description: '## Upcoming\n\nDraft notes for the next CLA release.\n\n- Bulk signing support\n- LDAP integration',
    version: '2.2.0',
    status: 'draft' as const,
    productSlug: 'e2e-easycla',
    authorIndex: 0,
    publishedAt: undefined,
  },
];
