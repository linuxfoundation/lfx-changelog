// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { BlogPostService } from '../services/blog-post.service';

import type { NextFunction, Request, Response } from 'express';

export class BlogPostController {
  private readonly blogPostService = new BlogPostService();

  // ── Public endpoints ───────────────────────────

  public async listPublished(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.blogPostService.findPublished({
        type: req.query['type'] as string | undefined,
        page: req.query['page'] ? parseInt(req.query['page'] as string, 10) : undefined,
        limit: req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : undefined,
      });

      // Flatten the join-table products/changelogs for the public API response
      const data = result.data.map((post) => ({
        ...post,
        products: post.products?.map((bp) => bp.product),
        changelogs: post.changelogs?.map((bc) => bc.changelogEntry),
      }));

      res.json({ success: true, ...result, data });
    } catch (error) {
      next(error);
    }
  }

  public async getPublishedBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const post = await this.blogPostService.findPublishedBySlug(req.params['slug'] as string);
      const data = {
        ...post,
        products: post.products?.map((bp) => bp.product),
        changelogs: post.changelogs?.map((bc) => bc.changelogEntry),
      };
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  // ── Admin endpoints ────────────────────────────

  public async listAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.blogPostService.findAll({
        type: req.query['type'] as string | undefined,
        status: req.query['status'] as string | undefined,
        page: req.query['page'] ? parseInt(req.query['page'] as string, 10) : undefined,
        limit: req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : undefined,
      });

      const data = result.data.map((post) => ({
        ...post,
        products: post.products?.map((bp) => bp.product),
        changelogs: post.changelogs?.map((bc) => bc.changelogEntry),
      }));

      res.json({ success: true, ...result, data });
    } catch (error) {
      next(error);
    }
  }

  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const post = await this.blogPostService.findById(req.params['id'] as string);
      const data = {
        ...post,
        products: post.products?.map((bp) => bp.product),
        changelogs: post.changelogs?.map((bc) => bc.changelogEntry),
      };
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const post = await this.blogPostService.create({
        ...req.body,
        createdBy: req.dbUser!.id,
      });
      const data = {
        ...post,
        products: post.products?.map((bp) => bp.product),
        changelogs: post.changelogs?.map((bc) => bc.changelogEntry),
      };
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  public async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const post = await this.blogPostService.update(req.params['id'] as string, req.body);
      const data = {
        ...post,
        products: post.products?.map((bp) => bp.product),
        changelogs: post.changelogs?.map((bc) => bc.changelogEntry),
      };
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  public async publish(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const post = await this.blogPostService.publish(req.params['id'] as string);
      const data = {
        ...post,
        products: post.products?.map((bp) => bp.product),
        changelogs: post.changelogs?.map((bc) => bc.changelogEntry),
      };
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  public async unpublish(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const post = await this.blogPostService.unpublish(req.params['id'] as string);
      const data = {
        ...post,
        products: post.products?.map((bp) => bp.product),
        changelogs: post.changelogs?.map((bc) => bc.changelogEntry),
      };
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.blogPostService.delete(req.params['id'] as string);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }

  public async linkProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const post = await this.blogPostService.linkProducts(req.params['id'] as string, req.body.productIds);
      const data = {
        ...post,
        products: post.products?.map((bp) => bp.product),
        changelogs: post.changelogs?.map((bc) => bc.changelogEntry),
      };
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  public async linkChangelogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const post = await this.blogPostService.linkChangelogs(req.params['id'] as string, req.body.changelogEntryIds);
      const data = {
        ...post,
        products: post.products?.map((bp) => bp.product),
        changelogs: post.changelogs?.map((bc) => bc.changelogEntry),
      };
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  public async getChangelogsForPeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const periodStart = req.query['periodStart'] as string;
      const periodEnd = req.query['periodEnd'] as string;
      const productIds = req.query['productIds'] ? (req.query['productIds'] as string).split(',') : undefined;

      const changelogs = await this.blogPostService.getChangelogsForPeriod(periodStart, periodEnd, productIds);
      res.json({ success: true, data: changelogs });
    } catch (error) {
      next(error);
    }
  }
}
