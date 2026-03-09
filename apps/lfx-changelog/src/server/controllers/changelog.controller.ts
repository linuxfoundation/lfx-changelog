// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { UserRole } from '@lfx-changelog/shared';
import { NextFunction, Request, Response } from 'express';

import { AuthenticationError, AuthorizationError, NotFoundError } from '../errors';
import { ChangelogService } from '../services/changelog.service';
import { getPrismaClient } from '../services/prisma.service';
import { SlackService } from '../services/slack.service';

import type { PostChangelogEntry } from '@lfx-changelog/shared';
import type { UserRoleAssignment } from '@prisma/client';

export class ChangelogController {
  private readonly changelogService = new ChangelogService();
  private readonly slackService = new SlackService();

  public async listPublished(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.changelogService.findPublished({
        productId: req.query['productId'] as string | undefined,
        page: req.query['page'] ? parseInt(req.query['page'] as string, 10) : undefined,
        limit: req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : undefined,
      });
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  public async getPublishedById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entry = await this.changelogService.findPublishedByIdentifier(req.params['id'] as string);
      res.json({ success: true, data: entry });
    } catch (error) {
      next(error);
    }
  }

  public async listAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const accessibleProductIds = this.getAccessibleProductIds(req);
      const result = await this.changelogService.findAll({
        productId: req.query['productId'] as string | undefined,
        status: req.query['status'] as string | undefined,
        page: req.query['page'] ? parseInt(req.query['page'] as string, 10) : undefined,
        limit: req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : undefined,
        accessibleProductIds,
      });
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entry = await this.changelogService.findById(req.params['id'] as string);

      // Non-super-admins cannot view drafts for products they don't have access to
      if (entry.status === 'draft') {
        const accessibleProductIds = this.getAccessibleProductIds(req);
        if (accessibleProductIds && !accessibleProductIds.includes(entry.productId)) {
          throw new AuthorizationError('You do not have access to this draft', { operation: 'getById', service: 'changelog' });
        }
      }

      res.json({ success: true, data: entry });
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entry = await this.changelogService.create({
        ...req.body,
        createdBy: req.dbUser!.id,
      });
      res.status(201).json({ success: true, data: entry });
    } catch (error) {
      next(error);
    }
  }

  public async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { createdBy, ...rest } = req.body;
      const hasCreatedBy = createdBy !== undefined && typeof createdBy === 'string' && createdBy.trim().length > 0;

      if (hasCreatedBy) {
        const userRoles = (req.dbUser?.userRoleAssignments ?? []) as UserRoleAssignment[];
        const isSuperAdmin = userRoles.some((a) => a.role === UserRole.SUPER_ADMIN);

        if (!isSuperAdmin && createdBy !== req.dbUser!.id) {
          throw new AuthorizationError('Only super admins can reassign authorship to another user', {
            operation: 'update',
            service: 'changelog',
          });
        }

        const prisma = getPrismaClient();
        const targetUser = await prisma.user.findUnique({ where: { id: createdBy } });
        if (!targetUser) {
          throw new NotFoundError(`Target author not found: ${createdBy}`, { operation: 'update', service: 'changelog' });
        }
      }

      const data = hasCreatedBy ? { ...rest, createdBy } : rest;
      const entry = await this.changelogService.update(req.params['id'] as string, data);
      res.json({ success: true, data: entry });
    } catch (error) {
      next(error);
    }
  }

  public async publish(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entry = await this.changelogService.publish(req.params['id'] as string);
      res.json({ success: true, data: entry });
    } catch (error) {
      next(error);
    }
  }

  public async unpublish(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entry = await this.changelogService.unpublish(req.params['id'] as string);
      res.json({ success: true, data: entry });
    } catch (error) {
      next(error);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.changelogService.delete(req.params['id'] as string);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }

  public async shareToSlack(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entry = await this.changelogService.findByIdForSlack(req.params['id'] as string);
      const { channelId, channelName } = req.body as { channelId: string; channelName: string };

      const mapped: PostChangelogEntry = {
        id: entry.id,
        slug: entry.slug,
        title: entry.title,
        description: entry.description,
        version: entry.version,
        product: entry.product,
        author: entry.author,
      };

      const result = await this.slackService.postChangelog(req.dbUser!.id, channelId, channelName, mapped);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ── View tracking ───────────────────────────

  public async getUnseenCounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const viewerId = this.resolveViewerId(req, req.query['viewerId'] as string | undefined);
      const productId = req.query['productId'] as string | undefined;
      const productIdsRaw = req.query['productIds'];

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

      const results = await this.changelogService.getUnseenCounts(viewerId, productIds);

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

      const targetIds: string[] = [...new Set([...(batchIds ?? []), ...(productId ? [productId] : [])])];

      const results = await this.changelogService.markViewed(viewerId, targetIds);

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
   * Extracts the product IDs that the authenticated user has access to.
   * Super admins get undefined (no filter — all products).
   * Editors/product admins get only their assigned product IDs.
   */
  private getAccessibleProductIds(req: Request): string[] | undefined {
    const userRoles = (req.dbUser?.userRoleAssignments ?? []) as UserRoleAssignment[];
    const isSuperAdmin = userRoles.some((a) => a.role === UserRole.SUPER_ADMIN);
    if (isSuperAdmin) return undefined;

    // A role with productId === null means "all products" (global editor/product admin)
    const hasGlobalRole = userRoles.some((a) => a.productId === null && (a.role === UserRole.EDITOR || a.role === UserRole.PRODUCT_ADMIN));
    if (hasGlobalRole) return undefined;

    return userRoles.filter((a) => a.productId !== null).map((a) => a.productId as string);
  }

  private resolveViewerId(req: Request, requestViewerId?: string): string {
    if (req.authMethod === 'oauth') {
      const sub = req.oidc?.user?.['sub'] as string | undefined;
      if (!sub) {
        throw new AuthenticationError('Missing Auth0 sub claim', { path: req.path });
      }
      return sub;
    }

    if (!requestViewerId) {
      throw new AuthenticationError('viewerId is required for API key authentication', { path: req.path });
    }
    return requestViewerId;
  }
}
