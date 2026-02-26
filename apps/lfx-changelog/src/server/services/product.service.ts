import type { PublicProduct } from '@lfx-changelog/shared';
import { Product as PrismaProduct } from '@prisma/client';

import { NotFoundError } from '../errors';

import { getPrismaClient } from './prisma.service';

export class ProductService {
  public async findAllPublic(): Promise<PublicProduct[]> {
    const prisma = getPrismaClient();
    return prisma.product.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, description: true, faIcon: true },
    });
  }

  public async findAll(): Promise<PrismaProduct[]> {
    const prisma = getPrismaClient();
    return prisma.product.findMany({ orderBy: { name: 'asc' } });
  }

  public async findById(id: string): Promise<PrismaProduct> {
    const prisma = getPrismaClient();
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundError(`Product not found: ${id}`, { operation: 'findById', service: 'product' });
    }
    return product;
  }

  public async create(data: { name: string; slug: string; description?: string; iconUrl?: string }): Promise<PrismaProduct> {
    const prisma = getPrismaClient();
    return prisma.product.create({ data });
  }

  public async update(id: string, data: { name?: string; slug?: string; description?: string; iconUrl?: string }): Promise<PrismaProduct> {
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
