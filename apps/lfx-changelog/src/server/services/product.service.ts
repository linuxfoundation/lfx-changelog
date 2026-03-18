// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Product as PrismaProduct } from '@prisma/client';

import { NotFoundError } from '../errors';
import { serverLogger } from '../server-logger';

import { getPrismaClient } from './prisma.service';

import type { LinkRepositoryRequest, PublicProduct, RepositoryWithCounts } from '@lfx-changelog/shared';
import type { ProductRepository as PrismaProductRepository } from '@prisma/client';

export class ProductService {
  public async findAllPublic(): Promise<PublicProduct[]> {
    const prisma = getPrismaClient();
    try {
      return await prisma.product.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, slug: true, description: true, faIcon: true },
      });
    } catch (error) {
      serverLogger.error({ err: error, operation: 'findAllPublic', service: 'product' }, 'Prisma query failed');
      throw error;
    }
  }

  public async findAll(): Promise<PrismaProduct[]> {
    const prisma = getPrismaClient();
    try {
      return await prisma.product.findMany({ orderBy: { name: 'asc' } });
    } catch (error) {
      serverLogger.error({ err: error, operation: 'findAll', service: 'product' }, 'Prisma query failed');
      throw error;
    }
  }

  public async findById(id: string): Promise<PrismaProduct> {
    const prisma = getPrismaClient();
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundError(`Product not found: ${id}`, { operation: 'findById', service: 'product' });
    }
    return product;
  }

  public async create(data: { name: string; slug: string; description?: string; iconUrl?: string; faIcon?: string }): Promise<PrismaProduct> {
    const prisma = getPrismaClient();
    return prisma.product.create({ data });
  }

  public async update(
    id: string,
    data: { name?: string; slug?: string; description?: string; iconUrl?: string; faIcon?: string; isActive?: boolean }
  ): Promise<PrismaProduct> {
    const prisma = getPrismaClient();
    await this.findById(id);
    return prisma.product.update({ where: { id }, data });
  }

  public async delete(id: string): Promise<void> {
    const prisma = getPrismaClient();
    await this.findById(id);
    await prisma.product.delete({ where: { id } });
  }

  // ── Repository operations ───────────────────────────

  public async findRepositoryById(repoId: string): Promise<PrismaProductRepository> {
    const prisma = getPrismaClient();
    const repo = await prisma.productRepository.findUnique({ where: { id: repoId } });
    if (!repo) {
      throw new NotFoundError(`Repository not found: ${repoId}`, { operation: 'findRepositoryById', service: 'product' });
    }
    return repo;
  }

  public async findAllRepositoriesWithCounts(): Promise<RepositoryWithCounts[]> {
    const prisma = getPrismaClient();
    const repos = await prisma.productRepository.findMany({
      include: {
        product: true,
        _count: { select: { releases: true } },
      },
      orderBy: [{ product: { name: 'asc' } }, { fullName: 'asc' }],
    });

    return repos.map((r) => ({
      id: r.id,
      productId: r.productId,
      githubInstallationId: r.githubInstallationId,
      owner: r.owner,
      name: r.name,
      fullName: r.fullName,
      htmlUrl: r.htmlUrl,
      description: r.description,
      isPrivate: r.isPrivate,
      lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      releaseCount: r._count.releases,
      productName: r.product.name,
      productFaIcon: r.product.faIcon,
    }));
  }

  public async findRepositoriesByProductId(productId: string): Promise<PrismaProductRepository[]> {
    const prisma = getPrismaClient();
    return prisma.productRepository.findMany({
      where: { productId },
      orderBy: { fullName: 'asc' },
    });
  }

  public async linkRepository(productId: string, data: LinkRepositoryRequest): Promise<PrismaProductRepository> {
    const prisma = getPrismaClient();

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundError(`Product not found: ${productId}`, { operation: 'linkRepository', service: 'product' });
    }

    return prisma.productRepository.upsert({
      where: {
        productId_owner_name: {
          productId,
          owner: data.owner,
          name: data.name,
        },
      },
      create: {
        productId,
        githubInstallationId: data.githubInstallationId,
        owner: data.owner,
        name: data.name,
        fullName: data.fullName,
        htmlUrl: data.htmlUrl,
        description: data.description || null,
        isPrivate: data.isPrivate,
      },
      update: {
        githubInstallationId: data.githubInstallationId,
        fullName: data.fullName,
        htmlUrl: data.htmlUrl,
        description: data.description || null,
        isPrivate: data.isPrivate,
      },
    });
  }

  public async unlinkRepository(productId: string, repoId: string): Promise<void> {
    const prisma = getPrismaClient();

    const repo = await prisma.productRepository.findFirst({
      where: { id: repoId, productId },
    });

    if (!repo) {
      throw new NotFoundError(`Repository not found: ${repoId}`, { operation: 'unlinkRepository', service: 'product' });
    }

    await prisma.productRepository.delete({ where: { id: repoId } });
  }

  // ── Slack notify users ──────────────────────────────

  public async findNotifyUsers(productId: string) {
    const prisma = getPrismaClient();
    return prisma.productSlackNotifyUser.findMany({
      where: { productId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  public async addNotifyUser(productId: string, userId: string) {
    const prisma = getPrismaClient();
    await this.findById(productId);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError(`User not found: ${userId}`, { operation: 'addNotifyUser', service: 'product' });
    }
    return prisma.productSlackNotifyUser.upsert({
      where: { productId_userId: { productId, userId } },
      create: { productId, userId },
      update: {},
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });
  }

  public async removeNotifyUser(productId: string, userId: string): Promise<void> {
    const prisma = getPrismaClient();
    await prisma.productSlackNotifyUser.deleteMany({ where: { productId, userId } });
  }

  public async findNotifyUserEmails(productId: string): Promise<string[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.productSlackNotifyUser.findMany({
      where: { productId },
      include: { user: { select: { email: true } } },
    });
    return rows.map((r) => r.user.email);
  }
}
