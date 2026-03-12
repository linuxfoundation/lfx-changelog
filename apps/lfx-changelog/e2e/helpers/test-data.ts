// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import {
  BlogStatus,
  BlogType,
  ChangelogStatus,
  CreateChangelogEntryRequestSchema,
  UserRole,
  UserRoleAssignmentSchema,
  UserSchema,
} from '@lfx-changelog/shared';
import { z } from 'zod';

import type { CreateProductRequest } from '@lfx-changelog/shared';

const TestUserSchema = UserSchema.pick({ email: true, name: true }).extend({
  role: z.union([UserRoleAssignmentSchema.shape.role, z.literal('user')]),
});

const TestRoleAssignmentSchema = UserRoleAssignmentSchema.pick({ role: true }).extend({
  userIndex: z.number(),
  productSlug: z.string(),
});

const TestChangelogSchema = CreateChangelogEntryRequestSchema.pick({ title: true, description: true, version: true, status: true }).extend({
  slug: z.string().optional(),
  productSlug: z.string(),
  authorIndex: z.number(),
  publishedAt: z.date().optional(),
});

const TestBlogPostSchema = z.object({
  title: z.string(),
  slug: z.string(),
  excerpt: z.string().optional(),
  description: z.string(),
  type: z.nativeEnum(BlogType),
  status: z.nativeEnum(BlogStatus),
  authorIndex: z.number(),
  publishedAt: z.date().optional(),
  periodStart: z.date().optional(),
  periodEnd: z.date().optional(),
});

type TestUser = z.infer<typeof TestUserSchema>;
type TestRoleAssignment = z.infer<typeof TestRoleAssignmentSchema>;
type TestChangelog = z.infer<typeof TestChangelogSchema>;
export type TestBlogPost = z.infer<typeof TestBlogPostSchema>;

function e2eEmail(role: string, fallback: string): string {
  return process.env[`E2E_${role}_EMAIL`] || fallback;
}

export const TEST_USERS: TestUser[] = [
  {
    email: e2eEmail('SUPER_ADMIN', 'test+changelog_super_admin@example.com'),
    name: 'E2E Super Admin',
    role: UserRole.SUPER_ADMIN,
  },
  {
    email: e2eEmail('PRODUCT_ADMIN', 'test+changelog_product_admin@example.com'),
    name: 'E2E Product Admin',
    role: UserRole.PRODUCT_ADMIN,
  },
  {
    email: e2eEmail('EDITOR', 'test+changelog_editor@example.com'),
    name: 'E2E Editor',
    role: UserRole.EDITOR,
  },
  {
    email: e2eEmail('USER', 'test+changelog_user@example.com'),
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

export const TEST_BLOG_POSTS: TestBlogPost[] = [
  {
    title: 'E2E: January 2026 Monthly Roundup',
    slug: 'e2e-january-2026-roundup',
    excerpt: 'Highlights from across LFX in January 2026.',
    description: '## January Highlights\n\nA busy month across all LFX products.',
    type: BlogType.MONTHLY_ROUNDUP,
    status: BlogStatus.PUBLISHED,
    authorIndex: 0,
    publishedAt: new Date('2026-02-01T10:00:00Z'),
    periodStart: new Date('2026-01-01'),
    periodEnd: new Date('2026-01-31'),
  },
  {
    title: 'E2E: EasyCLA Product Newsletter',
    slug: 'e2e-easycla-newsletter',
    description: '## EasyCLA Updates\n\nLatest improvements to the CLA workflow.',
    type: BlogType.PRODUCT_NEWSLETTER,
    status: BlogStatus.PUBLISHED,
    authorIndex: 0,
    publishedAt: new Date('2026-02-15T14:00:00Z'),
  },
  {
    title: 'E2E: Draft Upcoming Features',
    slug: 'e2e-draft-upcoming-features',
    description: '## Coming Soon\n\nDraft notes for upcoming features.',
    type: BlogType.MONTHLY_ROUNDUP,
    status: BlogStatus.DRAFT,
    authorIndex: 0,
  },
];

function generateBulkChangelogs(): TestChangelog[] {
  const productSlugs = TEST_PRODUCTS.map((p) => p.slug);
  return Array.from({ length: 22 }, (_, i) => ({
    title: `E2E: Bulk update ${i + 1}`,
    slug: `e2e-bulk-entry-${i + 1}`,
    description: `## Update ${i + 1}\n\nBulk test entry for pagination.`,
    version: `1.0.${i + 1}`,
    status: ChangelogStatus.PUBLISHED,
    productSlug: productSlugs[i % productSlugs.length]!,
    authorIndex: 0,
    publishedAt: new Date(`2026-03-${String(i + 1).padStart(2, '0')}T12:00:00Z`),
  }));
}

export const TEST_CHANGELOGS: TestChangelog[] = [
  {
    title: 'E2E: Added new CLA signature flow',
    slug: 'e2e-easycla-cla-signature-flow',
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
    slug: 'e2e-security-vulnerability-scanning',
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
    slug: 'e2e-insights-dashboard-redesign',
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
  ...generateBulkChangelogs(),
];
