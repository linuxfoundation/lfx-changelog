// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { NotFoundError } from '../errors';

import { getPrismaClient } from './prisma.service';

import type { LinkRepositoryRequest, RepositoryWithCounts } from '@lfx-changelog/shared';
import type { ProductRepository as PrismaProductRepository } from '@prisma/client';

export class ProductRepositoryService {
  public async findById(repoId: string): Promise<PrismaProductRepository> {
    const prisma = getPrismaClient();
    const repo = await prisma.productRepository.findUnique({ where: { id: repoId } });
    if (!repo) {
      throw new NotFoundError(`Repository not found: ${repoId}`, { operation: 'findById', service: 'product-repository' });
    }
    return repo;
  }

  public async findAllWithCounts(): Promise<RepositoryWithCounts[]> {
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

  public async findByProductId(productId: string): Promise<PrismaProductRepository[]> {
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
      throw new NotFoundError(`Product not found: ${productId}`, { operation: 'linkRepository', service: 'product-repository' });
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
      throw new NotFoundError(`Repository not found: ${repoId}`, { operation: 'unlinkRepository', service: 'product-repository' });
    }

    await prisma.productRepository.delete({ where: { id: repoId } });
  }
}
