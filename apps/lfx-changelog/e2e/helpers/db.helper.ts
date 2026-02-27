// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { TEST_CHANGELOGS, TEST_PRODUCTS, TEST_ROLE_ASSIGNMENTS, TEST_USERS } from './test-data.js';

let prisma: PrismaClient | null = null;

export function getTestPrismaClient(): PrismaClient {
  if (prisma) return prisma;

  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set. Ensure .env.e2e is configured.');
  }

  if (!databaseUrl.includes('_test')) {
    throw new Error('DATABASE_URL must contain "_test" to prevent accidental dev/prod database wipes. Aborting.');
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  prisma = new PrismaClient({ adapter });
  return prisma;
}

export async function cleanTestDatabase(): Promise<void> {
  const client = getTestPrismaClient();

  // Delete in FK-safe order
  await client.userRoleAssignment.deleteMany();
  await client.changelogEntry.deleteMany();
  await client.productRepository.deleteMany();
  await client.product.deleteMany();
  await client.user.deleteMany();
}

export async function seedTestDatabase(): Promise<void> {
  const client = getTestPrismaClient();

  // 1. Upsert products
  const products = await Promise.all(
    TEST_PRODUCTS.map((p) =>
      client.product.upsert({
        where: { slug: p.slug },
        update: { name: p.name, description: p.description, faIcon: p.faIcon },
        create: { name: p.name, slug: p.slug, description: p.description, faIcon: p.faIcon },
      })
    )
  );

  // Build slug-to-id map
  const productBySlug = new Map(products.map((p) => [p.slug, p]));

  // 2. Upsert users
  const users = await Promise.all(
    TEST_USERS.map((u) =>
      client.user.upsert({
        where: { auth0Id: u.auth0Id },
        update: { email: u.email, name: u.name },
        create: { auth0Id: u.auth0Id, email: u.email, name: u.name },
      })
    )
  );

  // 3. Create role assignments
  // Super admin gets global super_admin role (no product)
  await client.userRoleAssignment.create({
    data: {
      userId: users[0]!.id,
      productId: null,
      role: 'super_admin',
    },
  });

  // Product-scoped roles
  for (const assignment of TEST_ROLE_ASSIGNMENTS) {
    const product = productBySlug.get(assignment.productSlug);
    if (!product) throw new Error(`Product not found for slug: ${assignment.productSlug}`);

    await client.userRoleAssignment.create({
      data: {
        userId: users[assignment.userIndex]!.id,
        productId: product.id,
        role: assignment.role,
      },
    });
  }

  // 4. Create changelog entries
  for (const entry of TEST_CHANGELOGS) {
    const product = productBySlug.get(entry.productSlug);
    if (!product) throw new Error(`Product not found for slug: ${entry.productSlug}`);

    await client.changelogEntry.create({
      data: {
        productId: product.id,
        title: entry.title,
        description: entry.description,
        version: entry.version,
        status: entry.status,
        publishedAt: entry.publishedAt ?? null,
        createdBy: users[entry.authorIndex]!.id,
      },
    });
  }
}

export async function deactivateProduct(slug: string): Promise<void> {
  const client = getTestPrismaClient();
  await client.product.update({ where: { slug }, data: { isActive: false } });
}

export async function activateProduct(slug: string): Promise<void> {
  const client = getTestPrismaClient();
  await client.product.update({ where: { slug }, data: { isActive: true } });
}

export async function disconnectTestDb(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
