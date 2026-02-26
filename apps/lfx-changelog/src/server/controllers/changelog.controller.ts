// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { NextFunction, Request, Response } from 'express';

import { ChangelogService } from '../services/changelog.service';

export class ChangelogController {
  private readonly changelogService = new ChangelogService();

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
      const entry = await this.changelogService.findPublishedById(req.params['id'] as string);
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
      const dbUser = (req as any).dbUser;
      const entry = await this.changelogService.create({
        ...req.body,
        createdBy: dbUser.id,
      });
      res.status(201).json({ success: true, data: entry });
    } catch (error) {
      next(error);
    }
  }

  public async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entry = await this.changelogService.update(req.params['id'] as string, req.body);
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
      res.json({ success: true, data: null, message: 'Changelog entry deleted' });
    } catch (error) {
      next(error);
    }
  }
}
