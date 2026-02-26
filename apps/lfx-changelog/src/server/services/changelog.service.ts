// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { ChangelogStatus as ChangelogStatusEnum } from '@lfx-changelog/shared';
import { type ChangelogStatus, Prisma, type ChangelogEntry as PrismaChangelogEntry } from '@prisma/client';

import type { PublicChangelogEntry } from '@lfx-changelog/shared';

import { NotFoundError } from '../errors';

import { getPrismaClient } from './prisma.service';

export interface ChangelogQueryParams {
  productId?: string;
  status?: string;
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

const MAX_PAGE_SIZE = 100;

export class ChangelogService {
  public async findPublished(params: ChangelogQueryParams): Promise<PaginatedResult<PublicChangelogEntry>> {
    const prisma = getPrismaClient();
    const { page, limit, skip } = this.sanitizePagination(params);

    const where: Prisma.ChangelogEntryWhereInput = { status: 'published' };
    if (params.productId) where.productId = params.productId;

    const [data, total] = await Promise.all([
      prisma.changelogEntry.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          description: true,
          version: true,
          status: true,
          publishedAt: true,
          createdAt: true,
          product: { select: { id: true, name: true, slug: true, description: true, faIcon: true } },
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
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

  public async findAll(params: ChangelogQueryParams): Promise<PaginatedResult<PrismaChangelogEntry>> {
    const prisma = getPrismaClient();
    const { page, limit, skip } = this.sanitizePagination(params);

    const where: Prisma.ChangelogEntryWhereInput = {};
    if (params.productId) where.productId = params.productId;
    if (params.status) {
      const validStatuses = Object.values(ChangelogStatusEnum) as string[];
      if (validStatuses.includes(params.status)) {
        where.status = params.status as ChangelogStatus;
      }
    }

    const [data, total] = await Promise.all([
      prisma.changelogEntry.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
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

  public async findPublishedById(id: string): Promise<PublicChangelogEntry> {
    const prisma = getPrismaClient();
    const entry = await prisma.changelogEntry.findFirst({
      where: { id, status: 'published' },
      select: {
        id: true,
        title: true,
        description: true,
        version: true,
        status: true,
        publishedAt: true,
        createdAt: true,
        product: { select: { id: true, name: true, slug: true, description: true, faIcon: true } },
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
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
        status: (Object.values(ChangelogStatusEnum) as string[]).includes(data.status || '') ? (data.status as ChangelogStatus) : 'draft',
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
      data: data as Prisma.ChangelogEntryUpdateInput,
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

  private sanitizePagination(params: ChangelogQueryParams): { page: number; limit: number; skip: number } {
    const page = Math.max(1, Math.floor(params.page || 1));
    const limit = Math.max(1, Math.min(Math.floor(params.limit || 20), MAX_PAGE_SIZE));
    return { page, limit, skip: (page - 1) * limit };
  }
}
