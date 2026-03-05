// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { getPrismaClient } from './prisma.service';

import type { UnseenCount } from '@lfx-changelog/shared';

export class ChangelogViewService {
  /**
   * Returns unseen changelog counts for the given products (or all products if none specified).
   */
  public async getUnseenCounts(userId: string, productIds?: string[]): Promise<UnseenCount[]> {
    const prisma = getPrismaClient();

    // Get the user's view records
    const views = await prisma.changelogView.findMany({
      where: {
        userId,
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
   */
  public async markViewed(userId: string, productIds: string[]): Promise<{ productId: string; lastViewedAt: string }[]> {
    const prisma = getPrismaClient();

    const now = new Date();
    const results = await Promise.all(
      productIds.map(async (productId) => {
        await prisma.changelogView.upsert({
          where: {
            userId_productId: { userId, productId },
          },
          create: {
            userId,
            productId,
            lastViewedAt: now,
          },
          update: {
            lastViewedAt: now,
          },
        });

        return {
          productId,
          lastViewedAt: now.toISOString(),
        };
      })
    );

    return results;
  }
}
