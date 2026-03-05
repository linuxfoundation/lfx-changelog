// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { NotFoundError } from '../errors';
import { getPrismaClient } from './prisma.service';

import type { UnseenCount } from '@lfx-changelog/shared';

export class ChangelogViewService {
  /**
   * Returns unseen changelog counts for the given products (or all products if none specified).
   */
  public async getUnseenCounts(viewerId: string, productIds?: string[]): Promise<UnseenCount[]> {
    const prisma = getPrismaClient();

    // Get the viewer's view records
    const views = await prisma.changelogView.findMany({
      where: {
        viewerId,
        ...(productIds?.length ? { productId: { in: productIds } } : {}),
      },
    });

    const viewMap = new Map(views.map((v) => [v.productId, v.lastViewedAt]));

    // Determine which products to query
    let targetProductIds: string[];
    if (productIds?.length) {
      targetProductIds = productIds;
    } else {
      // All active products
      const products = await prisma.product.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      targetProductIds = products.map((p) => p.id);
    }

    // Count unseen published changelogs for each product
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

  /**
   * Marks one or more products' changelogs as viewed by upserting view records.
   * Wrapped in a transaction so all upserts succeed or none do.
   */
  public async markViewed(viewerId: string, productIds: string[]): Promise<{ productId: string; lastViewedAt: string }[]> {
    const prisma = getPrismaClient();

    // Pre-validate that all product IDs exist
    const existingProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    const existingIds = new Set(existingProducts.map((p) => p.id));
    const missing = productIds.filter((id) => !existingIds.has(id));
    if (missing.length > 0) {
      throw new NotFoundError(`Products not found: ${missing.join(', ')}`, { operation: 'markViewed', service: 'changelog-view' });
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
}
