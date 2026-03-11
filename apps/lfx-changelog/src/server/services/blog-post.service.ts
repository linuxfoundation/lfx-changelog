// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { BlogPostStatus as BlogPostStatusEnum, BlogPostType as BlogPostTypeEnum, MAX_PAGE_SIZE } from '@lfx-changelog/shared';
import { BlogPostStatus, BlogPostType, Prisma, BlogPost as PrismaBlogPost } from '@prisma/client';

import { ConflictError, NotFoundError } from '../errors';
import { getPrismaClient } from './prisma.service';

import type { BlogPostQueryParams, PaginatedResponse } from '@lfx-changelog/shared';

type PaginatedResult<T> = Omit<PaginatedResponse<T>, 'success'>;

type BlogPostWithRelations = PrismaBlogPost & {
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

const BLOG_POST_INCLUDE = {
  author: { select: { id: true, name: true, avatarUrl: true } },
  products: { include: { product: { select: { id: true, name: true, slug: true, description: true, faIcon: true } } } },
  changelogs: {
    include: {
      changelogEntry: { select: { id: true, slug: true, title: true, description: true, version: true, status: true, publishedAt: true, createdAt: true } },
    },
  },
} as const;

export class BlogPostService {
  public async findAll(params: BlogPostQueryParams): Promise<PaginatedResult<BlogPostWithRelations>> {
    const prisma = getPrismaClient();
    const { page, limit, skip } = this.sanitizePagination(params);

    const where: Prisma.BlogPostWhereInput = {};
    const validTypes = Object.values(BlogPostTypeEnum) as string[];
    const validStatuses = Object.values(BlogPostStatusEnum) as string[];
    if (params.type && validTypes.includes(params.type)) where.type = params.type as BlogPostType;
    if (params.status && validStatuses.includes(params.status)) where.status = params.status as BlogPostStatus;

    const [data, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        include: BLOG_POST_INCLUDE,
      }),
      prisma.blogPost.count({ where }),
    ]);

    return {
      data: data as BlogPostWithRelations[],
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  public async findById(id: string): Promise<BlogPostWithRelations> {
    const prisma = getPrismaClient();
    const post = await prisma.blogPost.findUnique({
      where: { id },
      include: BLOG_POST_INCLUDE,
    });
    if (!post) {
      throw new NotFoundError(`Blog post not found: ${id}`, { operation: 'findById', service: 'blog-post' });
    }
    return post as BlogPostWithRelations;
  }

  public async findPublished(params: BlogPostQueryParams): Promise<PaginatedResult<BlogPostWithRelations>> {
    const prisma = getPrismaClient();
    const { page, limit, skip } = this.sanitizePagination(params);

    const where: Prisma.BlogPostWhereInput = { status: 'published' };
    const validTypes = Object.values(BlogPostTypeEnum) as string[];
    if (params.type && validTypes.includes(params.type)) where.type = params.type as BlogPostType;

    const [data, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
        include: BLOG_POST_INCLUDE,
      }),
      prisma.blogPost.count({ where }),
    ]);

    return {
      data: data as BlogPostWithRelations[],
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  public async findPublishedBySlug(slug: string): Promise<BlogPostWithRelations> {
    const prisma = getPrismaClient();
    const normalizedSlug = slug.toLowerCase();
    const post = await prisma.blogPost.findFirst({
      where: { slug: normalizedSlug, status: 'published' },
      include: BLOG_POST_INCLUDE,
    });
    if (!post) {
      throw new NotFoundError(`Published blog post not found: ${slug}`, { operation: 'findPublishedBySlug', service: 'blog-post' });
    }
    return post as BlogPostWithRelations;
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
  }): Promise<BlogPostWithRelations> {
    const prisma = getPrismaClient();
    const slug = data.slug || this.generateSlug(data.title);
    const uniqueSlug = await this.ensureUniqueSlug(slug);

    try {
      const post = await prisma.blogPost.create({
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
        include: BLOG_POST_INCLUDE,
      });
      return post as BlogPostWithRelations;
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
  ): Promise<BlogPostWithRelations> {
    const prisma = getPrismaClient();
    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError(`Blog post not found: ${id}`, { operation: 'update', service: 'blog-post' });
    }

    const { periodStart, periodEnd, ...rest } = data;

    try {
      const updated = await prisma.blogPost.update({
        where: { id },
        data: {
          ...rest,
          ...(periodStart !== undefined ? { periodStart: periodStart ? new Date(periodStart) : null } : {}),
          ...(periodEnd !== undefined ? { periodEnd: periodEnd ? new Date(periodEnd) : null } : {}),
        } as Prisma.BlogPostUpdateInput,
        include: BLOG_POST_INCLUDE,
      });
      return updated as BlogPostWithRelations;
    } catch (error) {
      throw this.handleUniqueConstraint(error, data.slug) ?? error;
    }
  }

  public async publish(id: string): Promise<BlogPostWithRelations> {
    const prisma = getPrismaClient();
    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError(`Blog post not found: ${id}`, { operation: 'publish', service: 'blog-post' });
    }
    const published = await prisma.blogPost.update({
      where: { id },
      data: { status: 'published', publishedAt: new Date() },
      include: BLOG_POST_INCLUDE,
    });
    return published as BlogPostWithRelations;
  }

  public async unpublish(id: string): Promise<BlogPostWithRelations> {
    const prisma = getPrismaClient();
    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError(`Blog post not found: ${id}`, { operation: 'unpublish', service: 'blog-post' });
    }
    const draft = await prisma.blogPost.update({
      where: { id },
      data: { status: 'draft', publishedAt: null },
      include: BLOG_POST_INCLUDE,
    });
    return draft as BlogPostWithRelations;
  }

  public async delete(id: string): Promise<void> {
    const prisma = getPrismaClient();
    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError(`Blog post not found: ${id}`, { operation: 'delete', service: 'blog-post' });
    }
    await prisma.blogPost.delete({ where: { id } });
  }

  public async linkProducts(blogPostId: string, productIds: string[]): Promise<BlogPostWithRelations> {
    const prisma = getPrismaClient();
    const existing = await prisma.blogPost.findUnique({ where: { id: blogPostId } });
    if (!existing) {
      throw new NotFoundError(`Blog post not found: ${blogPostId}`, { operation: 'linkProducts', service: 'blog-post' });
    }

    // Replace all product links
    await prisma.$transaction([
      prisma.blogPostProduct.deleteMany({ where: { blogPostId } }),
      ...productIds.map((productId) => prisma.blogPostProduct.create({ data: { blogPostId, productId } })),
    ]);

    return this.findById(blogPostId);
  }

  public async linkChangelogs(blogPostId: string, changelogEntryIds: string[]): Promise<BlogPostWithRelations> {
    const prisma = getPrismaClient();
    const existing = await prisma.blogPost.findUnique({ where: { id: blogPostId } });
    if (!existing) {
      throw new NotFoundError(`Blog post not found: ${blogPostId}`, { operation: 'linkChangelogs', service: 'blog-post' });
    }

    // Replace all changelog links
    await prisma.$transaction([
      prisma.blogPostChangelogEntry.deleteMany({ where: { blogPostId } }),
      ...changelogEntryIds.map((changelogEntryId) => prisma.blogPostChangelogEntry.create({ data: { blogPostId, changelogEntryId } })),
    ]);

    return this.findById(blogPostId);
  }

  public async getChangelogsForPeriod(
    periodStart: string,
    periodEnd: string,
    productIds?: string[]
  ): Promise<{ id: string; title: string; slug: string | null; version: string | null; publishedAt: Date | null; productId: string }[]> {
    const prisma = getPrismaClient();
    const where: Prisma.ChangelogEntryWhereInput = {
      status: 'published',
      publishedAt: { gte: new Date(periodStart), lte: new Date(periodEnd) },
    };
    if (productIds?.length) {
      where.productId = { in: productIds };
    }

    return prisma.changelogEntry.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      select: { id: true, title: true, slug: true, version: true, publishedAt: true, productId: true },
    });
  }

  public async ensureUniqueSlug(slug: string): Promise<string> {
    const prisma = getPrismaClient();
    const existing = await prisma.blogPost.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;

    let suffix = 2;
    while (true) {
      const candidate = `${slug}-${suffix}`;
      const conflict = await prisma.blogPost.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!conflict) return candidate;
      suffix++;
    }
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private handleUniqueConstraint(error: unknown, slug?: string): ConflictError | null {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictError(`A blog post with slug "${slug}" already exists`, { operation: 'create', service: 'blog-post' });
    }
    return null;
  }

  private sanitizePagination(params: BlogPostQueryParams): { page: number; limit: number; skip: number } {
    const page = Math.max(1, Math.floor(params.page || 1));
    const limit = Math.max(1, Math.min(Math.floor(params.limit || 20), MAX_PAGE_SIZE));
    return { page, limit, skip: (page - 1) * limit };
  }
}
