// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { BlogStatus as BlogStatusEnum, BlogType as BlogTypeEnum, MAX_PAGE_SIZE } from '@lfx-changelog/shared';
import { BlogStatus, BlogType, Prisma, Blog as PrismaBlog } from '@prisma/client';

import { ConflictError, NotFoundError } from '../errors';
import { getPrismaClient } from './prisma.service';

import type { BlogPostQueryParams, PaginatedResponse } from '@lfx-changelog/shared';

type PaginatedResult<T> = Omit<PaginatedResponse<T>, 'success'>;

type BlogWithRelations = PrismaBlog & {
  author?: { id: string; name: string; avatarUrl: string | null };
  products?: { product: { id: string; name: string; slug: string; description: string | null; faIcon: string | null } }[];
  changelogs?: {
    changelogEntry: {
      id: string;
      slug: string | null;
      title: string;
      description: string;
      version: string | null;
      status: string;
      publishedAt: Date | null;
      createdAt: Date;
    };
  }[];
};

const BLOG_INCLUDE = {
  author: { select: { id: true, name: true, avatarUrl: true } },
  products: { include: { product: { select: { id: true, name: true, slug: true, description: true, faIcon: true } } } },
  changelogs: {
    include: {
      changelogEntry: { select: { id: true, slug: true, title: true, description: true, version: true, status: true, publishedAt: true, createdAt: true } },
    },
  },
} as const;

export class BlogService {
  public async findAll(params: BlogPostQueryParams): Promise<PaginatedResult<BlogWithRelations>> {
    const prisma = getPrismaClient();
    const { page, limit, skip } = this.sanitizePagination(params);

    const where: Prisma.BlogWhereInput = {};
    const validTypes = Object.values(BlogTypeEnum) as string[];
    const validStatuses = Object.values(BlogStatusEnum) as string[];
    if (params.type && validTypes.includes(params.type)) where.type = params.type as BlogType;
    if (params.status && validStatuses.includes(params.status)) where.status = params.status as BlogStatus;

    const [data, total] = await Promise.all([
      prisma.blog.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        include: BLOG_INCLUDE,
      }),
      prisma.blog.count({ where }),
    ]);

    return {
      data: data as BlogWithRelations[],
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  public async findById(id: string): Promise<BlogWithRelations> {
    const prisma = getPrismaClient();
    const post = await prisma.blog.findUnique({
      where: { id },
      include: BLOG_INCLUDE,
    });
    if (!post) {
      throw new NotFoundError(`Blog post not found: ${id}`, { operation: 'findById', service: 'blog' });
    }
    return post as BlogWithRelations;
  }

  public async findPublished(params: BlogPostQueryParams): Promise<PaginatedResult<BlogWithRelations>> {
    const prisma = getPrismaClient();
    const { page, limit, skip } = this.sanitizePagination(params);

    const where: Prisma.BlogWhereInput = { status: 'published', publishedAt: { not: null } };
    const validTypes = Object.values(BlogTypeEnum) as string[];
    if (params.type && validTypes.includes(params.type)) where.type = params.type as BlogType;

    const [data, total] = await Promise.all([
      prisma.blog.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
        include: BLOG_INCLUDE,
      }),
      prisma.blog.count({ where }),
    ]);

    return {
      data: data as BlogWithRelations[],
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  public async findPublishedBySlug(slug: string): Promise<BlogWithRelations> {
    const prisma = getPrismaClient();
    const normalizedSlug = slug.toLowerCase();
    const post = await prisma.blog.findFirst({
      where: { slug: normalizedSlug, status: 'published' },
      include: BLOG_INCLUDE,
    });
    if (!post) {
      throw new NotFoundError(`Published blog post not found: ${slug}`, { operation: 'findPublishedBySlug', service: 'blog' });
    }
    return post as BlogWithRelations;
  }

  public async create(data: {
    title: string;
    slug?: string;
    excerpt?: string;
    description: string;
    type: string;
    status?: string;
    coverImageUrl?: string;
    periodStart?: string;
    periodEnd?: string;
    productIds?: string[];
    changelogEntryIds?: string[];
    createdBy: string;
  }): Promise<BlogWithRelations> {
    const prisma = getPrismaClient();
    const slug = data.slug || this.generateSlug(data.title);
    const uniqueSlug = await this.ensureUniqueSlug(slug);

    try {
      const post = await prisma.blog.create({
        data: {
          title: data.title,
          slug: uniqueSlug,
          excerpt: data.excerpt,
          description: data.description,
          type: data.type === 'product_newsletter' ? 'product_newsletter' : 'monthly_roundup',
          status: data.status === 'published' ? 'published' : 'draft',
          coverImageUrl: data.coverImageUrl,
          periodStart: data.periodStart ? new Date(data.periodStart) : null,
          periodEnd: data.periodEnd ? new Date(data.periodEnd) : null,
          createdBy: data.createdBy,
          ...(data.productIds?.length ? { products: { create: data.productIds.map((productId) => ({ productId })) } } : {}),
          ...(data.changelogEntryIds?.length ? { changelogs: { create: data.changelogEntryIds.map((changelogEntryId) => ({ changelogEntryId })) } } : {}),
        },
        include: BLOG_INCLUDE,
      });
      return post as BlogWithRelations;
    } catch (error) {
      throw this.handleUniqueConstraint(error, uniqueSlug) ?? error;
    }
  }

  public async update(
    id: string,
    data: {
      title?: string;
      slug?: string;
      excerpt?: string;
      description?: string;
      type?: string;
      coverImageUrl?: string | null;
      periodStart?: string | null;
      periodEnd?: string | null;
    }
  ): Promise<BlogWithRelations> {
    const prisma = getPrismaClient();
    const existing = await prisma.blog.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError(`Blog post not found: ${id}`, { operation: 'update', service: 'blog' });
    }

    const { periodStart, periodEnd, ...rest } = data;

    try {
      const updated = await prisma.blog.update({
        where: { id },
        data: {
          ...rest,
          ...(periodStart !== undefined ? { periodStart: periodStart ? new Date(periodStart) : null } : {}),
          ...(periodEnd !== undefined ? { periodEnd: periodEnd ? new Date(periodEnd) : null } : {}),
        } as Prisma.BlogUpdateInput,
        include: BLOG_INCLUDE,
      });
      return updated as BlogWithRelations;
    } catch (error) {
      throw this.handleUniqueConstraint(error, data.slug, 'update') ?? error;
    }
  }

  public async publish(id: string): Promise<BlogWithRelations> {
    const prisma = getPrismaClient();
    const existing = await prisma.blog.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError(`Blog post not found: ${id}`, { operation: 'publish', service: 'blog' });
    }
    const published = await prisma.blog.update({
      where: { id },
      data: { status: 'published', publishedAt: new Date() },
      include: BLOG_INCLUDE,
    });
    return published as BlogWithRelations;
  }

  public async unpublish(id: string): Promise<BlogWithRelations> {
    const prisma = getPrismaClient();
    const existing = await prisma.blog.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError(`Blog post not found: ${id}`, { operation: 'unpublish', service: 'blog' });
    }
    const draft = await prisma.blog.update({
      where: { id },
      data: { status: 'draft', publishedAt: null },
      include: BLOG_INCLUDE,
    });
    return draft as BlogWithRelations;
  }

  public async delete(id: string): Promise<void> {
    const prisma = getPrismaClient();
    const existing = await prisma.blog.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError(`Blog post not found: ${id}`, { operation: 'delete', service: 'blog' });
    }
    await prisma.blog.delete({ where: { id } });
  }

  public async linkProducts(blogId: string, productIds: string[]): Promise<BlogWithRelations> {
    const prisma = getPrismaClient();
    const existing = await prisma.blog.findUnique({ where: { id: blogId } });
    if (!existing) {
      throw new NotFoundError(`Blog post not found: ${blogId}`, { operation: 'linkProducts', service: 'blog' });
    }

    // Replace all product links
    const uniqueProductIds = [...new Set(productIds)];
    await prisma.$transaction([
      prisma.blogProduct.deleteMany({ where: { blogId } }),
      prisma.blogProduct.createMany({ data: uniqueProductIds.map((productId) => ({ blogId, productId })) }),
    ]);

    return this.findById(blogId);
  }

  public async linkChangelogs(blogId: string, changelogEntryIds: string[]): Promise<BlogWithRelations> {
    const prisma = getPrismaClient();
    const existing = await prisma.blog.findUnique({ where: { id: blogId } });
    if (!existing) {
      throw new NotFoundError(`Blog post not found: ${blogId}`, { operation: 'linkChangelogs', service: 'blog' });
    }

    // Replace all changelog links
    const uniqueChangelogEntryIds = [...new Set(changelogEntryIds)];
    await prisma.$transaction([
      prisma.blogChangelogEntry.deleteMany({ where: { blogId } }),
      prisma.blogChangelogEntry.createMany({ data: uniqueChangelogEntryIds.map((changelogEntryId) => ({ blogId, changelogEntryId })) }),
    ]);

    return this.findById(blogId);
  }

  private async ensureUniqueSlug(slug: string): Promise<string> {
    const prisma = getPrismaClient();
    const existing = await prisma.blog.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;

    const MAX_SLUG_ATTEMPTS = 100;
    let suffix = 2;
    while (suffix <= MAX_SLUG_ATTEMPTS) {
      const candidate = `${slug}-${suffix}`;
      const conflict = await prisma.blog.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!conflict) return candidate;
      suffix++;
    }
    throw new ConflictError(`Unable to generate unique slug for "${slug}" after ${MAX_SLUG_ATTEMPTS} attempts`, {
      operation: 'ensureUniqueSlug',
      service: 'blog',
    });
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private handleUniqueConstraint(error: unknown, slug?: string, operation: string = 'create'): ConflictError | null {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictError(`A blog post with slug "${slug}" already exists`, { operation, service: 'blog' });
    }
    return null;
  }

  private sanitizePagination(params: BlogPostQueryParams): { page: number; limit: number; skip: number } {
    const page = Math.max(1, Math.floor(params.page || 1));
    const limit = Math.max(1, Math.min(Math.floor(params.limit || 20), MAX_PAGE_SIZE));
    return { page, limit, skip: (page - 1) * limit };
  }
}
