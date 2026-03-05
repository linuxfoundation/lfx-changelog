// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { AuthenticationError } from '../errors';
import { ChangelogViewService } from '../services/changelog-view.service';

import type { NextFunction, Request, Response } from 'express';

export class ChangelogViewController {
  private readonly changelogViewService = new ChangelogViewService();

  public async getUnseenCounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const viewerId = this.resolveViewerId(req, req.query['viewerId'] as string | undefined);
      const productId = req.query['productId'] as string | undefined;
      const productIdsRaw = req.query['productIds'];

      // Normalize productIds — Express may parse repeated keys as string[]
      let productIds: string[] | undefined;
      if (productId) {
        productIds = [productId];
      } else if (productIdsRaw) {
        const flat = Array.isArray(productIdsRaw) ? productIdsRaw.join(',') : (productIdsRaw as string);
        productIds = flat
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean);
      }

      const results = await this.changelogViewService.getUnseenCounts(viewerId, productIds);

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
      const viewerId = this.resolveViewerId(req, req.body.viewerId);
      const { productId, productIds: batchIds } = req.body;

      // Merge both fields — deduplicate in case productId is also in productIds
      const targetIds: string[] = [...new Set([...(batchIds ?? []), ...(productId ? [productId] : [])])];

      const results = await this.changelogViewService.markViewed(viewerId, targetIds);

      // Response shape keyed off request field, not dedup result:
      // productId alone → single object; productIds (even with 1 element) → array
      if (productId && !batchIds) {
        res.json({ success: true, data: results[0] });
      } else {
        res.json({ success: true, data: results });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Resolves the viewer ID based on auth method:
   * - OAuth: uses Auth0 sub claim from the session (ignores any provided viewerId)
   * - API key: requires viewerId from the request
   */
  private resolveViewerId(req: Request, requestViewerId?: string): string {
    if (req.authMethod === 'oauth') {
      const sub = req.oidc?.user?.['sub'] as string | undefined;
      if (!sub) {
        throw new AuthenticationError('Missing Auth0 sub claim', { path: req.path });
      }
      return sub;
    }

    // API key auth — viewerId is required from the request
    if (!requestViewerId) {
      throw new AuthenticationError('viewerId is required for API key authentication', { path: req.path });
    }
    return requestViewerId;
  }
}
