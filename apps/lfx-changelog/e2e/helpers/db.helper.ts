// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { BLOGS_INDEX, CHANGELOGS_INDEX } from '@lfx-changelog/shared';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { buildConnectionString } from '../../src/server/helpers/build-connection-string';
import { TEST_BLOG_POSTS, TEST_CHANGELOGS, TEST_PRODUCTS, TEST_ROLE_ASSIGNMENTS, TEST_USERS } from './test-data.js';

let prisma: PrismaClient | null = null;

export function getTestPrismaClient(): PrismaClient {
  if (prisma) return prisma;

  const connectionString = buildConnectionString();
  const dbName = new URL(connectionString).pathname.slice(1);

  if (!dbName.includes('_test')) {
    throw new Error(`Database name "${dbName}" must contain "_test" to prevent accidental dev/prod database wipes. Aborting.`);
  }

  const adapter = new PrismaPg({ connectionString });
  prisma = new PrismaClient({ adapter });
  return prisma;
}

export async function cleanTestDatabase(): Promise<void> {
  const client = getTestPrismaClient();

  // Delete in FK-safe order
  await client.blogChangelogEntry.deleteMany();
  await client.blogProduct.deleteMany();
  await client.blog.deleteMany();
  await client.chatMessage.deleteMany();
  await client.chatConversation.deleteMany();
  await client.apiKey.deleteMany();
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

  // 2. Upsert users (by email — auth0Id is no longer used for auth lookup)
  const users = await Promise.all(
    TEST_USERS.map((u) =>
      client.user.upsert({
        where: { email: u.email },
        update: { name: u.name },
        create: { email: u.email, name: u.name },
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
        slug: entry.slug ?? null,
        title: entry.title,
        description: entry.description,
        version: entry.version,
        status: entry.status,
        publishedAt: entry.publishedAt ?? null,
        createdBy: users[entry.authorIndex]!.id,
      },
    });
  }

  // 5. Create blog posts
  for (const post of TEST_BLOG_POSTS) {
    await client.blog.create({
      data: {
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt ?? null,
        description: post.description,
        type: post.type,
        status: post.status,
        publishedAt: post.publishedAt ?? null,
        periodStart: post.periodStart ?? null,
        periodEnd: post.periodEnd ?? null,
        createdBy: users[post.authorIndex]!.id,
      },
    });
  }
}

const OPENSEARCH_URL = process.env['OPENSEARCH_URL'] || 'http://localhost:9202';

export async function seedTestOpenSearch(): Promise<void> {
  const client = getTestPrismaClient();

  // ── Changelogs index ──────────────────────────────────────────────────────
  const indexRes = await fetch(`${OPENSEARCH_URL}/${CHANGELOGS_INDEX}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      settings: { number_of_shards: 1, number_of_replicas: 0 },
      mappings: {
        properties: {
          id: { type: 'keyword' },
          slug: { type: 'keyword' },
          title: { type: 'text', boost: 3 },
          description: { type: 'text' },
          version: { type: 'keyword' },
          status: { type: 'keyword' },
          publishedAt: { type: 'date' },
          createdAt: { type: 'date' },
          productId: { type: 'keyword' },
          productName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          productSlug: { type: 'keyword' },
          productFaIcon: { type: 'keyword' },
        },
      },
    }),
  });
  if (!indexRes.ok) {
    throw new Error(`Failed to create OpenSearch changelogs index: ${indexRes.status} ${await indexRes.text()}`);
  }

  // Query all published entries with their product relations
  const entries = await client.changelogEntry.findMany({
    where: { status: 'published' },
    include: { product: true },
  });

  // Index each published entry
  for (const entry of entries) {
    if (!entry.product) continue;

    const docRes = await fetch(`${OPENSEARCH_URL}/${CHANGELOGS_INDEX}/_doc/${entry.id}?refresh=wait_for`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: entry.id,
        slug: entry.slug,
        title: entry.title,
        description: entry.description,
        version: entry.version,
        status: entry.status,
        publishedAt: entry.publishedAt?.toISOString() ?? null,
        createdAt: entry.createdAt.toISOString(),
        productId: entry.productId,
        productName: entry.product.name,
        productSlug: entry.product.slug,
        productFaIcon: entry.product.faIcon,
      }),
    });
    if (!docRes.ok) {
      throw new Error(`Failed to index changelog entry ${entry.id}: ${docRes.status} ${await docRes.text()}`);
    }
  }

  // ── Blogs index ───────────────────────────────────────────────────────────
  const blogsIndexRes = await fetch(`${OPENSEARCH_URL}/${BLOGS_INDEX}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      settings: { number_of_shards: 1, number_of_replicas: 0 },
      mappings: {
        properties: {
          id: { type: 'keyword' },
          slug: { type: 'keyword' },
          title: { type: 'text', boost: 3 },
          excerpt: { type: 'text' },
          description: { type: 'text' },
          type: { type: 'keyword' },
          status: { type: 'keyword' },
          coverImageUrl: { type: 'keyword' },
          publishedAt: { type: 'date' },
          createdAt: { type: 'date' },
          authorName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          authorAvatarUrl: { type: 'keyword' },
          productNames: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          productIds: { type: 'keyword' },
        },
      },
    }),
  });
  if (!blogsIndexRes.ok) {
    throw new Error(`Failed to create OpenSearch blogs index: ${blogsIndexRes.status} ${await blogsIndexRes.text()}`);
  }

  // Query all published blogs with their relations
  const blogs = await client.blog.findMany({
    where: { status: 'published' },
    include: {
      author: { select: { name: true, avatarUrl: true } },
      products: { include: { product: { select: { id: true, name: true } } } },
    },
  });

  // Index each published blog
  for (const blog of blogs) {
    const docRes = await fetch(`${OPENSEARCH_URL}/${BLOGS_INDEX}/_doc/${blog.id}?refresh=wait_for`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: blog.id,
        slug: blog.slug,
        title: blog.title,
        excerpt: blog.excerpt,
        description: blog.description,
        type: blog.type,
        status: blog.status,
        coverImageUrl: blog.coverImageUrl,
        publishedAt: blog.publishedAt?.toISOString() ?? null,
        createdAt: blog.createdAt.toISOString(),
        authorName: blog.author?.name ?? 'Unknown',
        authorAvatarUrl: blog.author?.avatarUrl ?? null,
        productNames: blog.products?.map((p) => p.product.name) ?? [],
        productIds: blog.products?.map((p) => p.product.id) ?? [],
      }),
    });
    if (!docRes.ok) {
      throw new Error(`Failed to index blog ${blog.id}: ${docRes.status} ${await docRes.text()}`);
    }
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
