import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const products = [
  { name: 'LFX EasyCLA', slug: 'easycla', description: 'Streamline CLA management for open source projects' },
  { name: 'LFX Insights', slug: 'insights', description: 'Analytics and metrics for open source project health' },
  { name: 'LFX Mentorship', slug: 'mentorship', description: 'Connect mentors with mentees in open source communities' },
  { name: 'LFX Security', slug: 'security', description: 'Vulnerability detection and security scanning for open source' },
  { name: 'LFX Crowdfunding', slug: 'crowdfunding', description: 'Fund open source projects and initiatives' },
  { name: 'LFX Project Control Center', slug: 'project-control-center', description: 'Centralized project management for Linux Foundation projects' },
  { name: 'LFX Organization Dashboard', slug: 'organization-dashboard', description: 'Organization-level insights and management tools' },
];

const users = [
  { auth0Id: 'auth0|seed-admin-001', email: 'admin@linuxfoundation.org', name: 'Sarah Chen' },
  { auth0Id: 'auth0|seed-admin-002', email: 'product.admin@linuxfoundation.org', name: 'James Wilson' },
  { auth0Id: 'auth0|seed-editor-001', email: 'editor1@linuxfoundation.org', name: 'Maria Garcia' },
  { auth0Id: 'auth0|seed-editor-002', email: 'editor2@linuxfoundation.org', name: 'Alex Johnson' },
  { auth0Id: 'auth0|seed-editor-003', email: 'editor3@linuxfoundation.org', name: 'Priya Patel' },
  { auth0Id: 'auth0|seed-viewer-001', email: 'viewer@linuxfoundation.org', name: 'Tom Brown' },
];

async function main() {
  console.info('Seeding database...');

  // Create products
  const createdProducts = await Promise.all(
    products.map((p) => prisma.product.upsert({ where: { slug: p.slug }, update: p, create: p }))
  );
  console.info(`Created ${createdProducts.length} products`);

  // Create users
  const createdUsers = await Promise.all(
    users.map((u) => prisma.user.upsert({ where: { auth0Id: u.auth0Id }, update: u, create: u }))
  );
  console.info(`Created ${createdUsers.length} users`);

  // Assign roles
  const superAdmin = createdUsers[0]!;
  const productAdmin = createdUsers[1]!;
  const editors = createdUsers.slice(2, 5);

  await prisma.userRoleAssignment.upsert({
    where: { userId_productId_role: { userId: superAdmin.id, productId: null as any, role: 'super_admin' } },
    update: {},
    create: { userId: superAdmin.id, role: 'super_admin' },
  });

  for (const product of createdProducts.slice(0, 3)) {
    await prisma.userRoleAssignment.upsert({
      where: { userId_productId_role: { userId: productAdmin.id, productId: product.id, role: 'product_admin' } },
      update: {},
      create: { userId: productAdmin.id, productId: product.id, role: 'product_admin' },
    });
  }

  for (const editor of editors) {
    const product = createdProducts[Math.floor(Math.random() * createdProducts.length)]!;
    await prisma.userRoleAssignment
      .create({ data: { userId: editor.id, productId: product.id, role: 'editor' } })
      .catch(() => {});
  }
  console.info('Assigned roles');

  // Create changelog entries
  const entries = [
    { title: 'Fixed CLA signature validation issue', description: 'Resolved a bug where corporate CLA signatures were not being validated correctly for contributors with multiple email addresses.', version: '2.4.1', status: 'published' as const },
    { title: 'Added real-time project health dashboard', description: 'New dashboard view showing real-time metrics for project health including commit activity, PR velocity, and issue resolution time.', version: '3.0.0', status: 'published' as const },
    { title: 'Improved mentorship matching algorithm', description: 'Enhanced the matching algorithm to consider timezone overlap, technical skill alignment, and mentor availability patterns.', version: '1.8.0', status: 'published' as const },
    { title: 'Breaking: Updated vulnerability API response format', description: '**Breaking Change:** The `/api/vulnerabilities` endpoint now returns a paginated response with a different schema. See migration guide.', version: '4.0.0', status: 'published' as const },
    { title: 'Fixed duplicate funding notification emails', description: 'Resolved an issue where backers were receiving duplicate email notifications when a funding milestone was reached.', version: '1.2.3', status: 'published' as const },
    { title: 'Added organization-level analytics export', description: 'Organization admins can now export analytics data in CSV and JSON formats with customizable date ranges.', version: '2.1.0', status: 'published' as const },
    { title: 'Performance improvements for large repositories', description: 'Optimized scanning for repositories with 10k+ files, reducing scan time by up to 60%.', version: '3.5.2', status: 'published' as const },
    { title: 'New committee management features', description: 'Added support for managing project committees including member roles, voting, and meeting scheduling.', version: '5.0.0', status: 'published' as const },
    { title: 'Draft: Enhanced search functionality', description: 'Work in progress on full-text search across all changelog entries with filters for product and date range.', version: '2.5.0', status: 'draft' as const },
    { title: 'Fixed timezone handling in meeting scheduler', description: 'Corrected timezone conversion issues that caused meetings to display at incorrect times for users in non-US timezones.', version: '1.3.1', status: 'published' as const },
    { title: 'Added SBOM generation support', description: 'LFX Security now supports automatic Software Bill of Materials generation for scanned projects.', version: '4.1.0', status: 'published' as const },
    { title: 'Draft: Role-based access control improvements', description: 'Upcoming improvements to RBAC including granular permissions per project area.', version: '5.1.0', status: 'draft' as const },
    { title: 'Improved CLA bot GitHub integration', description: 'The CLA bot now supports GitHub App installation flow and provides better inline status checks on pull requests.', version: '2.5.0', status: 'published' as const },
    { title: 'Fixed incorrect contributor count on Insights', description: 'Resolved a calculation error where contributors from forked repositories were being double-counted.', version: '3.1.1', status: 'published' as const },
    { title: 'Draft: New mentorship program templates', description: 'Introducing configurable program templates to help projects quickly set up structured mentorship programs.', version: '2.0.0', status: 'draft' as const },
  ];

  const now = new Date();
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const product = createdProducts[i % createdProducts.length]!;
    const author = createdUsers[i % createdUsers.length]!;
    const daysAgo = entries.length - i;
    const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    await prisma.changelogEntry.create({
      data: {
        title: entry.title,
        description: entry.description,
        version: entry.version,

        status: entry.status,
        productId: product.id,
        createdBy: author.id,
        createdAt,
        publishedAt: entry.status === 'published' ? createdAt : null,
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
