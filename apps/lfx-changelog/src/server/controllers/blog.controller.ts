// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { BlogService } from '../services/blog.service';

import type { NextFunction, Request, Response } from 'express';

export class BlogController {
  private readonly blogService = new BlogService();

  // ── Public endpoints ───────────────────────────

  public async listPublished(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.blogService.findPublished({
        type: req.query['type'] as string | undefined,
        page: req.query['page'] ? parseInt(req.query['page'] as string, 10) : undefined,
        limit: req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : undefined,
      });

      // Flatten the join-table products/changelogs for the public API response
      const data = result.data.map((post) => ({
        ...post,
        products: post.products?.map((bp) => bp.product),
        changelogEntries: post.changelogs?.map((bc) => bc.changelogEntry),
      }));

      res.json({ success: true, ...result, data });
    } catch (error) {
      next(error);
    }
  }

  public async getPublishedBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const post = await this.blogService.findPublishedBySlug(req.params['slug'] as string);
      const data = {
        ...post,
        products: post.products?.map((bp) => bp.product),
        changelogEntries: post.changelogs?.map((bc) => bc.changelogEntry),
      };
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  // ── Admin endpoints ────────────────────────────

  public async listAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.blogService.findAll({
        type: req.query['type'] as string | undefined,
        status: req.query['status'] as string | undefined,
        page: req.query['page'] ? parseInt(req.query['page'] as string, 10) : undefined,
        limit: req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : undefined,
      });

      const data = result.data.map((post) => ({
        ...post,
        products: post.products?.map((bp) => bp.product),
        changelogEntries: post.changelogs?.map((bc) => bc.changelogEntry),
      }));

      res.json({ success: true, ...result, data });
    } catch (error) {
      next(error);
    }
  }

  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const post = await this.blogService.findById(req.params['id'] as string);
      const data = {
        ...post,
        products: post.products?.map((bp) => bp.product),
        changelogEntries: post.changelogs?.map((bc) => bc.changelogEntry),
      };
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const post = await this.blogService.create({
        ...req.body,
        createdBy: req.dbUser!.id,
      });
      const data = {
        ...post,
        products: post.products?.map((bp) => bp.product),
        changelogEntries: post.changelogs?.map((bc) => bc.changelogEntry),
      };
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  public async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const post = await this.blogService.update(req.params['id'] as string, req.body);
      const data = {
        ...post,
        products: post.products?.map((bp) => bp.product),
        changelogEntries: post.changelogs?.map((bc) => bc.changelogEntry),
      };
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  public async publish(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const post = await this.blogService.publish(req.params['id'] as string);
      const data = {
        ...post,
        products: post.products?.map((bp) => bp.product),
        changelogEntries: post.changelogs?.map((bc) => bc.changelogEntry),
      };
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  public async unpublish(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const post = await this.blogService.unpublish(req.params['id'] as string);
      const data = {
        ...post,
        products: post.products?.map((bp) => bp.product),
        changelogEntries: post.changelogs?.map((bc) => bc.changelogEntry),
      };
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.blogService.delete(req.params['id'] as string);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }

  public async linkProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const post = await this.blogService.linkProducts(req.params['id'] as string, req.body.productIds);
      const data = {
        ...post,
        products: post.products?.map((bp) => bp.product),
        changelogEntries: post.changelogs?.map((bc) => bc.changelogEntry),
      };
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  public async linkChangelogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const post = await this.blogService.linkChangelogs(req.params['id'] as string, req.body.changelogEntryIds);
      const data = {
        ...post,
        products: post.products?.map((bp) => bp.product),
        changelogEntries: post.changelogs?.map((bc) => bc.changelogEntry),
      };
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}
