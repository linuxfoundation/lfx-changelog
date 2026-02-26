// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { LinkRepositoryRequest } from '@lfx-changelog/shared';
import type { ProductRepository as PrismaProductRepository } from '@prisma/client';

import { NotFoundError } from '../errors';

import { getPrismaClient } from './prisma.service';

export class ProductRepositoryService {
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
