import { ChangelogEntry as PrismaChangelogEntry } from '@prisma/client';

import { NotFoundError } from '../errors';

import { getPrismaClient } from './prisma.service';

export interface ChangelogQueryParams {
  productId?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ChangelogService {
  public async findPublished(params: ChangelogQueryParams): Promise<PaginatedResult<PrismaChangelogEntry>> {
    const prisma = getPrismaClient();
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { status: 'published' };
    if (params.productId) where.productId = params.productId;

    const [data, total] = await Promise.all([
      prisma.changelogEntry.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
        include: { product: true, author: true },
      }),
      prisma.changelogEntry.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  public async findPublishedById(id: string): Promise<PrismaChangelogEntry> {
    const prisma = getPrismaClient();
    const entry = await prisma.changelogEntry.findFirst({
      where: { id, status: 'published' },
      include: { product: true, author: true },
    });
    if (!entry) {
      throw new NotFoundError(`Published changelog entry not found: ${id}`, { operation: 'findPublishedById', service: 'changelog' });
    }
    return entry;
  }

  public async create(data: {
    productId: string;
    title: string;
    description: string;
    version?: string;
    status?: string;
    createdBy: string;
  }): Promise<PrismaChangelogEntry> {
    const prisma = getPrismaClient();
    return prisma.changelogEntry.create({
      data: {
        productId: data.productId,
        title: data.title,
        description: data.description,
        version: data.version,
        status: (data.status as any) || 'draft',
        createdBy: data.createdBy,
      },
      include: { product: true, author: true },
    });
  }

  public async update(
    id: string,
    data: {
      title?: string;
      description?: string;
      version?: string;
      status?: string;
    }
  ): Promise<PrismaChangelogEntry> {
    const prisma = getPrismaClient();
    const entry = await prisma.changelogEntry.findUnique({ where: { id } });
    if (!entry) {
      throw new NotFoundError(`Changelog entry not found: ${id}`, { operation: 'update', service: 'changelog' });
    }
    return prisma.changelogEntry.update({
      where: { id },
      data: data as any,
      include: { product: true, author: true },
    });
  }

  public async publish(id: string): Promise<PrismaChangelogEntry> {
    const prisma = getPrismaClient();
    const entry = await prisma.changelogEntry.findUnique({ where: { id } });
    if (!entry) {
      throw new NotFoundError(`Changelog entry not found: ${id}`, { operation: 'publish', service: 'changelog' });
    }
    return prisma.changelogEntry.update({
      where: { id },
      data: { status: 'published', publishedAt: new Date() },
      include: { product: true, author: true },
    });
  }

  public async delete(id: string): Promise<void> {
    const prisma = getPrismaClient();
    const entry = await prisma.changelogEntry.findUnique({ where: { id } });
    if (!entry) {
      throw new NotFoundError(`Changelog entry not found: ${id}`, { operation: 'delete', service: 'changelog' });
    }
    await prisma.changelogEntry.delete({ where: { id } });
  }

  public async findById(id: string): Promise<PrismaChangelogEntry> {
    const prisma = getPrismaClient();
    const entry = await prisma.changelogEntry.findUnique({
      where: { id },
      include: { product: true, author: true },
    });
    if (!entry) {
      throw new NotFoundError(`Changelog entry not found: ${id}`, { operation: 'findById', service: 'changelog' });
    }
    return entry;
  }
}
