// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Product as PrismaProduct } from '@prisma/client';

import { NotFoundError } from '../errors';
import { findContributorsForRepositories, recalculateContributorTotals } from '../helpers/contributor-totals.helper';
import { serverLogger } from '../server-logger';

import { getPrismaClient } from './prisma.service';

import type { LinkRepositoryRequest, ProductRepositoryWithCount, PublicProduct, RepositoryWithCounts } from '@lfx-changelog/shared';
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

    // Deleting a product cascades through its repositories to the contributor links, so the
    // same recalculation unlinkRepository performs is required here.
    const repositories = await prisma.productRepository.findMany({ where: { productId: id }, select: { id: true } });
    const contributorIds = await findContributorsForRepositories(
      prisma,
      repositories.map((repository) => repository.id)
    );

    await prisma.$transaction(async (tx) => {
      await tx.product.delete({ where: { id } });
      await recalculateContributorTotals(tx, contributorIds);
    });

    serverLogger.info({ productId: id, contributorsRecalculated: contributorIds.length }, 'Deleted product and refreshed contributor totals');
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

  /**
   * Repositories for the product detail page, each with how many releases are stored for it.
   * Separate from `findRepositoriesByProductId`, whose Prisma rows the sync and activity paths
   * pass straight to GitHubService.
   */
  public async findRepositoriesWithReleaseCounts(productId: string): Promise<ProductRepositoryWithCount[]> {
    const prisma = getPrismaClient();
    const repositories = await prisma.productRepository.findMany({
      where: { productId },
      include: { _count: { select: { releases: true } } },
      orderBy: { fullName: 'asc' },
    });

    return repositories.map((repository) => ({
      id: repository.id,
      productId: repository.productId,
      githubInstallationId: repository.githubInstallationId,
      owner: repository.owner,
      name: repository.name,
      fullName: repository.fullName,
      htmlUrl: repository.htmlUrl,
      description: repository.description,
      isPrivate: repository.isPrivate,
      lastSyncedAt: repository.lastSyncedAt?.toISOString() ?? null,
      createdAt: repository.createdAt.toISOString(),
      updatedAt: repository.updatedAt.toISOString(),
      releaseCount: repository._count.releases,
    }));
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

    // The delete cascades ContributorRepository rows away, which would leave
    // Contributor.contributions overstated with no way back — once the repository is untracked,
    // no later sync can repair those totals.
    const contributorIds = await findContributorsForRepositories(prisma, [repoId]);

    await prisma.$transaction(async (tx) => {
      await tx.productRepository.delete({ where: { id: repoId } });
      await recalculateContributorTotals(tx, contributorIds);
    });

    serverLogger.info({ repoId, productId, contributorsRecalculated: contributorIds.length }, 'Unlinked repository and refreshed contributor totals');
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
