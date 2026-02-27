// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Product as PrismaProduct } from '@prisma/client';

import { NotFoundError } from '../errors';
import { serverLogger } from '../server-logger';

import { getPrismaClient } from './prisma.service';

import type { PublicProduct } from '@lfx-changelog/shared';

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
}
