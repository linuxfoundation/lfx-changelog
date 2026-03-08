// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { ChangelogCategory as ChangelogCategoryEnum, ChangelogStatus as ChangelogStatusEnum, MAX_PAGE_SIZE } from '@lfx-changelog/shared';
import { ChangelogCategory, ChangelogStatus, Prisma, ChangelogEntry as PrismaChangelogEntry } from '@prisma/client';

import { ConflictError, NotFoundError } from '../errors';
import { serverLogger } from '../server-logger';
import { getPrismaClient } from './prisma.service';
import { SearchService } from './search.service';

import type { ChangelogDocument, ChangelogQueryParams, PaginatedResponse, PublicChangelogEntry, UnseenCount } from '@lfx-changelog/shared';

type PaginatedResult<T> = Omit<PaginatedResponse<T>, 'success'>;

export class ChangelogService {
  private readonly searchService = new SearchService();

  public async findPublished(params: ChangelogQueryParams): Promise<PaginatedResult<PublicChangelogEntry>> {
    const prisma = getPrismaClient();
    const { page, limit, skip } = this.sanitizePagination(params);

    const where: Prisma.ChangelogEntryWhereInput = { status: 'published', product: { isActive: true } };
    if (params.productId) where.productId = params.productId;
    if (params.query) {
      where.OR = [{ title: { contains: params.query, mode: 'insensitive' } }, { description: { contains: params.query, mode: 'insensitive' } }];
    }

    try {
      const [data, total] = await Promise.all([
        prisma.changelogEntry.findMany({
          where,
          orderBy: { publishedAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            version: true,
            category: true,
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
        data: data as PublicChangelogEntry[],
        total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      serverLogger.error({ err: error, operation: 'findPublished', service: 'changelog' }, 'Prisma query failed');
      throw error;
    }
  }

  public async findAll(params: ChangelogQueryParams): Promise<PaginatedResult<PrismaChangelogEntry>> {
    const prisma = getPrismaClient();
    const { page, limit, skip } = this.sanitizePagination(params);

    const where: Prisma.ChangelogEntryWhereInput = {};
    if (params.productId) where.productId = params.productId;
    if (params.query) {
      where.OR = [{ title: { contains: params.query, mode: 'insensitive' } }, { description: { contains: params.query, mode: 'insensitive' } }];
    }
    if (params.status) {
      const validStatuses = Object.values(ChangelogStatusEnum) as string[];
      if (validStatuses.includes(params.status)) {
        where.status = params.status as ChangelogStatus;
      }
    }

    const [data, total] = await Promise.all([
      prisma.changelogEntry.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
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

  public async findPublishedByIdentifier(identifier: string): Promise<PublicChangelogEntry> {
    const prisma = getPrismaClient();
    const normalizedSlug = identifier.toLowerCase();
    const entry = await prisma.changelogEntry.findFirst({
      where: { OR: [{ id: identifier }, { slug: normalizedSlug }], status: 'published', product: { isActive: true } },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        version: true,
        category: true,
        status: true,
        publishedAt: true,
        createdAt: true,
        product: { select: { id: true, name: true, slug: true, description: true, faIcon: true } },
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    if (!entry) {
      throw new NotFoundError(`Published changelog entry not found: ${identifier}`, { operation: 'findPublishedByIdentifier', service: 'changelog' });
    }
    return entry as PublicChangelogEntry;
  }

  public async create(data: {
    productId: string;
    slug?: string;
    title: string;
    description: string;
    version?: string;
    category?: string;
    status?: string;
    source?: string;
    createdBy: string;
  }): Promise<PrismaChangelogEntry> {
    const prisma = getPrismaClient();
    try {
      const validCategories = Object.values(ChangelogCategoryEnum) as string[];
      const entry = await prisma.changelogEntry.create({
        data: {
          productId: data.productId,
          slug: data.slug || null,
          title: data.title,
          description: data.description,
          version: data.version,
          source: data.source === 'automated' ? 'automated' : 'manual',
          category: data.category && validCategories.includes(data.category) ? (data.category as ChangelogCategory) : null,
          status: (Object.values(ChangelogStatusEnum) as string[]).includes(data.status || '') ? (data.status as ChangelogStatus) : 'draft',
          createdBy: data.createdBy,
        },
        include: { product: true, author: true },
      });
      this.syncToOpenSearch(entry);
      return entry;
    } catch (error) {
      throw this.handleUniqueConstraint(error, data.slug) ?? error;
    }
  }

  public async update(
    id: string,
    data: {
      slug?: string;
      title?: string;
      description?: string;
      version?: string;
      category?: string | null;
      status?: string;
      createdBy?: string;
    }
  ): Promise<PrismaChangelogEntry> {
    const prisma = getPrismaClient();
    const existing = await prisma.changelogEntry.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError(`Changelog entry not found: ${id}`, { operation: 'update', service: 'changelog' });
    }

    const validCategories = Object.values(ChangelogCategoryEnum) as string[];
    const updateData: Record<string, unknown> = { ...data };
    if ('category' in data) {
      updateData['category'] = data.category && validCategories.includes(data.category) ? (data.category as ChangelogCategory) : null;
    }

    let updated: PrismaChangelogEntry;
    try {
      updated = await prisma.changelogEntry.update({
        where: { id },
        data: updateData as Prisma.ChangelogEntryUpdateInput,
        include: { product: true, author: true },
      });
    } catch (error) {
      throw this.handleUniqueConstraint(error, data.slug) ?? error;
    }

    // If status changed away from published, remove from search index
    if (existing.status === 'published' && data.status && data.status !== 'published') {
      this.searchService
        .deleteDocument(id)
        .catch((err) => serverLogger.warn({ err, id }, 'Failed to remove changelog from OpenSearch'));
    } else {
      this.syncToOpenSearch(updated);
    }
    return updated;
  }

  public async publish(id: string): Promise<PrismaChangelogEntry> {
    const prisma = getPrismaClient();
    const entry = await prisma.changelogEntry.findUnique({ where: { id } });
    if (!entry) {
      throw new NotFoundError(`Changelog entry not found: ${id}`, { operation: 'publish', service: 'changelog' });
    }
    const published = await prisma.changelogEntry.update({
      where: { id },
      data: { status: 'published', publishedAt: new Date() },
      include: { product: true, author: true },
    });
    this.syncToOpenSearch(published);
    return published;
  }

  public async unpublish(id: string): Promise<PrismaChangelogEntry> {
    const prisma = getPrismaClient();
    const entry = await prisma.changelogEntry.findUnique({ where: { id } });
    if (!entry) {
      throw new NotFoundError(`Changelog entry not found: ${id}`, { operation: 'unpublish', service: 'changelog' });
    }
    const draft = await prisma.changelogEntry.update({
      where: { id },
      data: { status: 'draft', publishedAt: null },
      include: { product: true, author: true },
    });
    this.searchService
      .deleteDocument(id)
      .catch((err) => serverLogger.warn({ err, id }, 'Failed to remove changelog from OpenSearch'));
    return draft;
  }

  public async delete(id: string): Promise<void> {
    const prisma = getPrismaClient();
    const entry = await prisma.changelogEntry.findUnique({ where: { id } });
    if (!entry) {
      throw new NotFoundError(`Changelog entry not found: ${id}`, { operation: 'delete', service: 'changelog' });
    }
    await prisma.changelogEntry.delete({ where: { id } });
    this.searchService
      .deleteDocument(id)
      .catch((err) => serverLogger.warn({ err, id }, 'Failed to remove changelog from OpenSearch'));
  }

  /**
   * Returns the latest semantic version string for a product, or null if none exist.
   * Checks all entries (published + draft) ordered by most recent first.
   */
  public async getLatestVersion(productId: string): Promise<string | null> {
    const prisma = getPrismaClient();
    const entry = await prisma.changelogEntry.findFirst({
      where: { productId, version: { not: null }, NOT: { version: '' } },
      orderBy: { createdAt: 'desc' },
      select: { version: true },
    });
    return entry?.version ?? null;
  }

  /**
   * Ensures the given slug is unique among changelog entries.
   * If a collision exists, appends `-2`, `-3`, etc. until a unique slug is found.
   */
  public async ensureUniqueSlug(slug: string): Promise<string> {
    const prisma = getPrismaClient();
    const existing = await prisma.changelogEntry.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;

    let suffix = 2;
    while (true) {
      const candidate = `${slug}-${suffix}`;
      const conflict = await prisma.changelogEntry.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!conflict) return candidate;
      suffix++;
    }
  }

  /**
   * Finds the most recent automated draft for a product, if one exists.
   */
  public async findAutomatedDraft(productId: string): Promise<PrismaChangelogEntry | null> {
    const prisma = getPrismaClient();
    return prisma.changelogEntry.findFirst({
      where: { productId, source: 'automated', status: 'draft' },
      orderBy: { updatedAt: 'desc' },
    });
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

  public async findByIdForSlack(
    id: string
  ): Promise<PrismaChangelogEntry & { product: { name: string; faIcon: string | null } | null; author: { name: string } | null }> {
    const prisma = getPrismaClient();
    const entry = await prisma.changelogEntry.findUnique({
      where: { id },
      include: {
        product: { select: { name: true, faIcon: true } },
        author: { select: { name: true } },
      },
    });
    if (!entry) {
      throw new NotFoundError(`Changelog entry not found: ${id}`, { operation: 'findByIdForSlack', service: 'changelog' });
    }
    return entry;
  }

  // ── View tracking ───────────────────────────

  public async getUnseenCounts(viewerId: string, productIds?: string[]): Promise<UnseenCount[]> {
    const prisma = getPrismaClient();

    const views = await prisma.changelogView.findMany({
      where: {
        viewerId,
        ...(productIds?.length ? { productId: { in: productIds } } : {}),
      },
    });

    const viewMap = new Map(views.map((v) => [v.productId, v.lastViewedAt]));

    let targetProductIds: string[];
    if (productIds?.length) {
      targetProductIds = productIds;
    } else {
      const products = await prisma.product.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      targetProductIds = products.map((p) => p.id);
    }

    const results: UnseenCount[] = await Promise.all(
      targetProductIds.map(async (productId) => {
        const lastViewedAt = viewMap.get(productId) ?? null;

        const unseenCount = await prisma.changelogEntry.count({
          where: {
            productId,
            status: 'published',
            publishedAt: { not: null, ...(lastViewedAt ? { gt: lastViewedAt } : {}) },
          },
        });

        return {
          productId,
          unseenCount,
          lastViewedAt: lastViewedAt?.toISOString() ?? null,
        };
      })
    );

    return results;
  }

  public async markViewed(viewerId: string, productIds: string[]): Promise<{ productId: string; lastViewedAt: string }[]> {
    const prisma = getPrismaClient();

    const existingProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    const existingIds = new Set(existingProducts.map((p) => p.id));
    const missing = productIds.filter((id) => !existingIds.has(id));
    if (missing.length > 0) {
      throw new NotFoundError(`Products not found: ${missing.join(', ')}`, { operation: 'markViewed', service: 'changelog' });
    }

    const now = new Date();
    await prisma.$transaction(
      productIds.map((productId) =>
        prisma.changelogView.upsert({
          where: {
            viewerId_productId: { viewerId, productId },
          },
          create: {
            viewerId,
            productId,
            lastViewedAt: now,
          },
          update: {
            lastViewedAt: now,
          },
        })
      )
    );

    return productIds.map((productId) => ({
      productId,
      lastViewedAt: now.toISOString(),
    }));
  }

  private syncToOpenSearch(entry: PrismaChangelogEntry & { product?: { name: string; slug: string; faIcon: string | null } | null }): void {
    if (entry.status !== 'published' || !entry.product) return;

    const doc: ChangelogDocument = {
      id: entry.id,
      slug: entry.slug,
      title: entry.title,
      description: entry.description,
      version: entry.version,
      status: entry.status,
      publishedAt: entry.publishedAt?.toISOString() ?? null,
      createdAt: entry.createdAt.toISOString(),
      productId: entry.productId,
      productName: entry.product.name,
      productSlug: entry.product.slug,
      productFaIcon: entry.product.faIcon,
    };

    this.searchService
      .indexDocument(doc)
      .catch((err) => serverLogger.warn({ err, id: entry.id }, 'Failed to sync changelog to OpenSearch'));
  }

  private handleUniqueConstraint(error: unknown, slug?: string): ConflictError | null {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictError(`A changelog entry with slug "${slug}" already exists`, { operation: 'create', service: 'changelog' });
    }
    return null;
  }

  private sanitizePagination(params: ChangelogQueryParams): { page: number; limit: number; skip: number } {
    const page = Math.max(1, Math.floor(params.page || 1));
    const limit = Math.max(1, Math.min(Math.floor(params.limit || 20), MAX_PAGE_SIZE));
    return { page, limit, skip: (page - 1) * limit };
  }
}
