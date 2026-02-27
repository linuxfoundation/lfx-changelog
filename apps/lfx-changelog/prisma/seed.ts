// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { buildConnectionString } from '../src/server/helpers/build-connection-string';

const adapter = new PrismaPg({ connectionString: buildConnectionString() });
const prisma = new PrismaClient({ adapter });

const products = [
  {
    name: 'Organization Dashboard',
    slug: 'organization-dashboard',
    description: 'Measure your impact',
    faIcon: 'fa-duotone fa-building',
  },
  {
    name: 'Individual Dashboard',
    slug: 'individual-dashboard',
    description: 'Track and share your achievements',
    faIcon: 'fa-duotone fa-id-badge',
  },
  {
    name: 'Project Control Center',
    slug: 'project-control-center',
    description: 'Manage your project',
    faIcon: 'fa-duotone fa-bars-progress',
  },
  {
    name: 'Security',
    slug: 'security',
    description: 'Secure your project',
    faIcon: 'fa-duotone fa-shield-halved',
  },
  {
    name: 'EasyCLA',
    slug: 'easycla',
    description: 'Make contributing easy',
    faIcon: 'fa-duotone fa-file-contract',
  },
  {
    name: 'Insights',
    slug: 'insights',
    description: 'Gain deep analytics into project health',
    faIcon: 'fa-duotone fa-chart-mixed',
  },
  {
    name: 'Mentorship',
    slug: 'mentorship',
    description: 'Develop diverse talent',
    faIcon: 'fa-duotone fa-hand-holding-heart',
  },
  {
    name: 'Crowdfunding',
    slug: 'crowdfunding',
    description: 'Support open technologies',
    faIcon: 'fa-duotone fa-chart-pie',
  },
  {
    name: 'Community Data Platform',
    slug: 'community-data-platform',
    description: 'Collect and manage community data',
    faIcon: 'fa-duotone fa-users',
  },
];

const users = [{ auth0Id: 'auth0|asitha', email: 'adesilva@linuxfoundation.org', name: 'Asitha de Silva', avatarUrl: null }];

async function main() {
  console.info('Seeding database...');

  // Create products
  const createdProducts = await Promise.all(products.map((p) => prisma.product.upsert({ where: { slug: p.slug }, update: p, create: p })));
  console.info(`Created ${createdProducts.length} products`);

  // Build slug→product lookup
  const productBySlug = Object.fromEntries(createdProducts.map((p) => [p.slug, p]));

  // Create users
  const createdUsers = await Promise.all(users.map((u) => prisma.user.upsert({ where: { auth0Id: u.auth0Id }, update: u, create: u })));
  console.info(`Created ${createdUsers.length} users`);

  // Assign super_admin role
  const [asitha] = createdUsers;
  await prisma.userRoleAssignment.create({ data: { userId: asitha!.id, role: 'super_admin' } }).catch(() => {});

  console.info('Assigned roles');

  // Create changelog entries — matching mock data exactly
  const entries = [
    {
      productSlug: 'easycla',
      authorIndex: 0,
      title: 'GitHub App permission model update',
      description:
        'Updated the GitHub App integration to use fine-grained permissions. This reduces the scope of access required and improves security for organizations using EasyCLA.\n\n- Removed legacy OAuth scope requirements\n- Added support for repository-level permissions\n- Improved error messages for permission issues',
      version: '2.5.0',
      status: 'published' as const,
      publishedAt: '2024-09-15T10:00:00.000Z',
      createdAt: '2024-09-12T08:30:00.000Z',
    },
    {
      productSlug: 'easycla',
      authorIndex: 0,
      title: 'Fix CLA signature verification for forked repositories',
      description:
        'Resolved an issue where CLA signature verification failed for pull requests originating from forked repositories. The check now correctly traces the commit author back to the original CLA signee.',
      version: '2.4.3',
      status: 'published' as const,
      publishedAt: '2024-08-28T14:00:00.000Z',
      createdAt: '2024-08-25T11:00:00.000Z',
    },
    {
      productSlug: 'insights',
      authorIndex: 0,
      title: 'New contributor growth dashboard',
      description:
        'Introducing a brand-new contributor growth dashboard that provides visibility into how your community is expanding over time.\n\n**Key features:**\n- Monthly active contributor trends\n- New vs returning contributor breakdown\n- Geographic distribution heatmap\n- Organization affiliation tracking',
      version: '3.1.0',
      status: 'published' as const,
      publishedAt: '2024-09-20T09:00:00.000Z',
      createdAt: '2024-09-18T15:00:00.000Z',
    },
    {
      productSlug: 'insights',
      authorIndex: 0,
      title: 'Deprecate legacy CSV export endpoint',
      description:
        'The `/api/v1/export/csv` endpoint has been deprecated and will be removed in v4.0. Please migrate to the new `/api/v2/reports/export` endpoint which supports CSV, JSON, and PDF formats.\n\n**Migration guide:** See our documentation at docs.linuxfoundation.org/insights/migration.',
      version: '3.0.0',
      status: 'published' as const,
      publishedAt: '2024-07-01T08:00:00.000Z',
      createdAt: '2024-06-28T10:00:00.000Z',
    },
    {
      productSlug: 'insights',
      authorIndex: 0,
      title: 'Performance improvements for large project analytics',
      description:
        'Optimized data aggregation queries for projects with over 10,000 contributors. Dashboard load times reduced by approximately 60% for large-scale projects.',
      version: '3.0.2',
      status: 'published' as const,
      publishedAt: '2024-08-10T12:00:00.000Z',
      createdAt: '2024-08-08T09:30:00.000Z',
    },
    {
      productSlug: 'mentorship',
      authorIndex: 0,
      title: 'Application review workflow redesign',
      description:
        'Completely redesigned the mentorship application review workflow for program administrators.\n\n- Bulk accept/reject actions\n- Inline applicant profile previews\n- Customizable evaluation criteria\n- Email notification templates',
      version: '1.8.0',
      status: 'published' as const,
      publishedAt: '2024-09-05T11:00:00.000Z',
      createdAt: '2024-09-01T14:00:00.000Z',
    },
    {
      productSlug: 'mentorship',
      authorIndex: 0,
      title: 'Fix timezone display in program schedules',
      description:
        "Fixed an issue where program start and end dates were displayed in UTC instead of the user's local timezone. All date displays now respect the browser timezone setting.",
      version: '1.7.5',
      status: 'published' as const,
      publishedAt: '2024-08-20T15:30:00.000Z',
      createdAt: '2024-08-18T10:00:00.000Z',
    },
    {
      productSlug: 'security',
      authorIndex: 0,
      title: 'SPDX 3.0 SBOM support',
      description:
        'Added support for SPDX 3.0 Software Bill of Materials (SBOM) format. Projects can now generate and import SBOMs in the latest SPDX standard.\n\n- SPDX 3.0 generation and parsing\n- Backward compatibility with SPDX 2.3\n- Improved license expression handling',
      version: '4.2.0',
      status: 'published' as const,
      publishedAt: '2024-09-25T08:00:00.000Z',
      createdAt: '2024-09-22T16:00:00.000Z',
    },
    {
      productSlug: 'security',
      authorIndex: 0,
      title: 'Critical vulnerability alert email improvements',
      description:
        'Enhanced the critical vulnerability alert emails with clearer severity indicators, direct links to remediation guides, and one-click snooze options for acknowledged vulnerabilities.',
      version: '4.1.2',
      status: 'published' as const,
      publishedAt: '2024-08-15T09:00:00.000Z',
      createdAt: '2024-08-12T13:45:00.000Z',
    },
    {
      productSlug: 'crowdfunding',
      authorIndex: 0,
      title: 'Stripe Connect onboarding flow update',
      description:
        'Updated the Stripe Connect onboarding flow to comply with new KYC requirements. Fund recipients may need to re-verify their identity through the updated flow.',
      version: '2.3.0',
      status: 'published' as const,
      publishedAt: '2024-09-01T10:00:00.000Z',
      createdAt: '2024-08-29T08:00:00.000Z',
    },
    {
      productSlug: 'crowdfunding',
      authorIndex: 0,
      title: 'Fix duplicate donation receipts',
      description:
        'Resolved a race condition that caused some donors to receive duplicate email receipts when making contributions. Added idempotency keys to the payment processing pipeline.',
      version: '2.2.4',
      status: 'published' as const,
      publishedAt: '2024-07-18T14:00:00.000Z',
      createdAt: '2024-07-15T11:30:00.000Z',
    },
    {
      productSlug: 'project-control-center',
      authorIndex: 0,
      title: 'Meeting minutes auto-generation with AI',
      description:
        'Project Control Center now supports AI-powered meeting minutes generation. After a recorded meeting, PCC will automatically generate a structured summary with action items.\n\n**Note:** This feature requires enabling the AI add-on in project settings.',
      version: '5.0.0',
      status: 'published' as const,
      publishedAt: '2024-09-10T09:00:00.000Z',
      createdAt: '2024-09-08T10:00:00.000Z',
    },
    {
      productSlug: 'project-control-center',
      authorIndex: 0,
      title: 'Committee role assignment bug fix',
      description:
        'Fixed an issue where removing a user from a committee did not revoke their associated permissions. Committee role changes now propagate correctly across all linked services.',
      version: '4.9.3',
      status: 'published' as const,
      publishedAt: '2024-08-05T11:00:00.000Z',
      createdAt: '2024-08-02T15:30:00.000Z',
    },
    {
      productSlug: 'organization-dashboard',
      authorIndex: 0,
      title: 'New member activity feed',
      description:
        'Added a real-time activity feed to the Organization Dashboard showing recent contributions, CLA signatures, and membership changes across all affiliated projects.',
      version: '1.4.0',
      status: 'published' as const,
      publishedAt: '2024-09-18T10:00:00.000Z',
      createdAt: '2024-09-15T09:00:00.000Z',
    },
    {
      productSlug: 'organization-dashboard',
      authorIndex: 0,
      title: 'Fix SSO login redirect loop',
      description:
        'Resolved an issue where users authenticating via SSO were caught in a redirect loop when their session token expired during an active dashboard session.',
      version: '1.3.2',
      status: 'published' as const,
      publishedAt: '2024-08-22T13:00:00.000Z',
      createdAt: '2024-08-20T10:00:00.000Z',
    },
    {
      productSlug: 'easycla',
      authorIndex: 0,
      title: 'GitLab integration support',
      description:
        'EasyCLA now supports GitLab as a source code platform in addition to GitHub and Gerrit. Organizations can configure CLA checks for GitLab merge requests.\n\n- GitLab webhook integration\n- Merge request status checks\n- GitLab group-level configuration',
      version: '2.6.0',
      status: 'draft' as const,
      publishedAt: null,
      createdAt: '2024-09-28T08:00:00.000Z',
    },
    {
      productSlug: 'security',
      authorIndex: 0,
      title: 'Remove support for CycloneDX 1.3',
      description:
        'Support for CycloneDX 1.3 format has been removed. Please update your SBOM tooling to generate CycloneDX 1.4 or later.\n\nCycloneDX 1.4 and 1.5 remain fully supported.',
      version: '4.3.0',
      status: 'draft' as const,
      publishedAt: null,
      createdAt: '2024-09-30T09:00:00.000Z',
    },
    {
      productSlug: 'insights',
      authorIndex: 0,
      title: 'Add DORA metrics dashboard',
      description:
        'New DORA (DevOps Research and Assessment) metrics dashboard providing visibility into deployment frequency, lead time for changes, change failure rate, and time to restore service.',
      version: '3.2.0',
      status: 'draft' as const,
      publishedAt: null,
      createdAt: '2024-10-01T10:00:00.000Z',
    },
  ];

  for (const entry of entries) {
    const product = productBySlug[entry.productSlug]!;
    const author = createdUsers[entry.authorIndex]!;

    await prisma.changelogEntry.create({
      data: {
        title: entry.title,
        description: entry.description,
        version: entry.version,
        status: entry.status,
        productId: product.id,
        createdBy: author.id,
        createdAt: new Date(entry.createdAt),
        publishedAt: entry.publishedAt ? new Date(entry.publishedAt) : null,
      },
    });
  }
  console.info(`Created ${entries.length} changelog entries`);

  console.info('Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
