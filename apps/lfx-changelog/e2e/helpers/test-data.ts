// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import {
  BlogStatus,
  BlogType,
  ChangelogStatus,
  ContributorSchema,
  CreateChangelogEntryRequestSchema,
  LinkRepositoryRequestSchema,
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

const TestRepositorySchema = LinkRepositoryRequestSchema.pick({ githubInstallationId: true, owner: true, name: true, fullName: true, htmlUrl: true }).extend({
  productSlug: z.string(),
});

const TestContributorSchema = ContributorSchema.pick({ githubUserId: true, githubLogin: true, emails: true, contributions: true }).extend({
  name: z.string().optional(),
  primaryEmail: z.string().optional(),
  isBot: z.boolean().optional(),
  slackUserId: z.string().optional(),
  slackRealName: z.string().optional(),
  slackDisplayName: z.string().optional(),
});

type TestUser = z.infer<typeof TestUserSchema>;
type TestRoleAssignment = z.infer<typeof TestRoleAssignmentSchema>;
type TestChangelog = z.infer<typeof TestChangelogSchema>;
type TestRepository = z.infer<typeof TestRepositorySchema>;
type TestContributor = z.infer<typeof TestContributorSchema>;
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

export const TEST_REPOSITORY: TestRepository = {
  productSlug: 'e2e-easycla',
  githubInstallationId: 999001,
  owner: 'linuxfoundation',
  name: 'e2e-easycla-repo',
  fullName: 'linuxfoundation/e2e-easycla-repo',
  htmlUrl: 'https://github.com/linuxfoundation/e2e-easycla-repo',
};

/**
 * Belongs to a product the product admin has no assignment for, so release endpoints can be
 * checked for reporting 404 rather than 403 on a repository that exists but is out of scope.
 */
export const TEST_FOREIGN_REPOSITORY: TestRepository = {
  productSlug: 'e2e-security',
  githubInstallationId: 999002,
  owner: 'linuxfoundation',
  name: 'e2e-security-repo',
  fullName: 'linuxfoundation/e2e-security-repo',
  htmlUrl: 'https://github.com/linuxfoundation/e2e-security-repo',
};

interface TestRelease {
  repository: 'primary' | 'foreign';
  githubId: number;
  tagName: string;
  name: string;
  isDraft?: boolean;
  isPrerelease?: boolean;
}

/**
 * The draft is deliberate: release counts and the history view must agree, and both exclude
 * drafts. Without one seeded, a count that silently included drafts would still look correct.
 */
export const TEST_RELEASES: TestRelease[] = [
  { repository: 'primary', githubId: 910001, tagName: 'v1.0.0', name: 'EasyCLA v1.0.0' },
  { repository: 'primary', githubId: 910002, tagName: 'v1.1.0', name: 'EasyCLA v1.1.0' },
  { repository: 'primary', githubId: 910003, tagName: 'v1.2.0-rc.1', name: 'EasyCLA v1.2.0-rc.1', isPrerelease: true },
  { repository: 'primary', githubId: 910004, tagName: 'v1.3.0-draft', name: 'Unpublished draft', isDraft: true },
  { repository: 'foreign', githubId: 920001, tagName: 'sec-v0.9.0', name: 'Security v0.9.0' },
];

/**
 * `linked-dev` and `unlink-me-dev` are both Slack-linked so the filter assertions and the
 * destructive unlink spec don't contend for the same row.
 */
export const TEST_CONTRIBUTORS: TestContributor[] = [
  {
    githubUserId: 900001,
    githubLogin: 'e2e-octo-dev',
    name: 'E2E Octo Dev',
    primaryEmail: 'octo-dev@e2e.test',
    emails: ['octo-dev@e2e.test'],
    contributions: 42,
  },
  {
    githubUserId: 900002,
    githubLogin: 'e2e-linked-dev',
    name: 'E2E Linked Dev',
    primaryEmail: 'linked-dev@e2e.test',
    emails: ['linked-dev@e2e.test'],
    contributions: 17,
    slackUserId: 'U0E2ELINKED',
    slackRealName: 'E2E Linked Dev',
    slackDisplayName: 'linked-dev',
  },
  {
    githubUserId: 900003,
    githubLogin: 'e2e-unlink-me-dev',
    name: 'E2E Unlink Me',
    primaryEmail: 'unlink-me@e2e.test',
    emails: ['unlink-me@e2e.test'],
    contributions: 9,
    slackUserId: 'U0E2EUNLINK',
    slackRealName: 'E2E Unlink Me',
    slackDisplayName: 'unlink-me',
  },
  {
    githubUserId: 900004,
    githubLogin: 'e2e-api-unlink-dev',
    name: 'E2E Api Unlink',
    primaryEmail: 'api-unlink@e2e.test',
    emails: ['api-unlink@e2e.test'],
    contributions: 5,
    slackUserId: 'U0E2EAPI',
    slackRealName: 'E2E Api Unlink',
    slackDisplayName: 'api-unlink',
  },
  {
    githubUserId: 900005,
    githubLogin: 'e2e-delete-me-dev',
    name: 'E2E Delete Me',
    primaryEmail: 'delete-me@e2e.test',
    emails: ['delete-me@e2e.test'],
    contributions: 3,
  },
  {
    githubUserId: 900006,
    githubLogin: 'e2e-testbot[bot]',
    name: 'E2E Test Bot',
    emails: [],
    contributions: 500,
    isBot: true,
  },
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
    publishedAt: new Date(`2025-01-${String(i + 1).padStart(2, '0')}T12:00:00Z`),
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
