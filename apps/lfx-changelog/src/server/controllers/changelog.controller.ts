// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { UserRole } from '@lfx-changelog/shared';
import { NextFunction, Request, Response } from 'express';

import { AuthorizationError, NotFoundError } from '../errors';
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
      const result = await this.changelogService.findAll({
        productId: req.query['productId'] as string | undefined,
        status: req.query['status'] as string | undefined,
        page: req.query['page'] ? parseInt(req.query['page'] as string, 10) : undefined,
        limit: req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : undefined,
      });
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entry = await this.changelogService.findById(req.params['id'] as string);
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

      if (createdBy) {
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

      const data = createdBy ? { ...rest, createdBy } : rest;
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
}
