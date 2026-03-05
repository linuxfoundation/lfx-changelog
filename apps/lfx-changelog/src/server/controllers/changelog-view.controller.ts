// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { ChangelogViewService } from '../services/changelog-view.service';

import type { NextFunction, Request, Response } from 'express';

export class ChangelogViewController {
  private readonly changelogViewService = new ChangelogViewService();

  public async getUnseenCounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.dbUser!.id;
      const productId = req.query['productId'] as string | undefined;
      const productIdsParam = req.query['productIds'] as string | undefined;

      // Parse productIds from comma-separated string
      let productIds: string[] | undefined;
      if (productId) {
        productIds = [productId];
      } else if (productIdsParam) {
        productIds = productIdsParam
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean);
      }

      const results = await this.changelogViewService.getUnseenCounts(userId, productIds);

      // Single product → return single object; batch/all → return array
      if (productId) {
        res.json({ success: true, data: results[0] ?? { productId, unseenCount: 0, lastViewedAt: null } });
      } else {
        res.json({ success: true, data: results });
      }
    } catch (error) {
      next(error);
    }
  }

  public async markViewed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.dbUser!.id;
      const { productId, productIds: batchIds } = req.body;

      // Collect target IDs from either field
      const targetIds: string[] = batchIds?.length ? batchIds : [productId];

      const results = await this.changelogViewService.markViewed(userId, targetIds);

      // Single product → return single object; batch → return array
      if (productId && !batchIds?.length) {
        res.json({ success: true, data: results[0] });
      } else {
        res.json({ success: true, data: results });
      }
    } catch (error) {
      next(error);
    }
  }
}
