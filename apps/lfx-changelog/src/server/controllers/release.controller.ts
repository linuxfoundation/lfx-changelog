// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { ProductRepositoryService } from '../services/product-repository.service';
import { ReleaseService } from '../services/release.service';

import type { NextFunction, Request, Response } from 'express';

export class ReleaseController {
  private readonly releaseService = new ReleaseService();
  private readonly productRepositoryService = new ProductRepositoryService();

  public async listPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : undefined;
      const productId = req.query['productId'] as string | undefined;

      const releases = await this.releaseService.findAllPublic({ limit, productId });
      res.json({ success: true, data: releases });
    } catch (error) {
      next(error);
    }
  }

  public async sync(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = req.params['productId'] as string;
      const synced = await this.releaseService.syncForProduct(productId);
      res.json({ success: true, data: { synced } });
    } catch (error) {
      next(error);
    }
  }

  public async syncRepository(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const repoId = req.params['repoId'] as string;
      const repo = await this.productRepositoryService.findById(repoId);
      const synced = await this.releaseService.syncForRepository(repo);
      res.json({ success: true, data: { synced } });
    } catch (error) {
      next(error);
    }
  }

  public async listRepositories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const repos = await this.productRepositoryService.findAllWithCounts();
      res.json({ success: true, data: repos });
    } catch (error) {
      next(error);
    }
  }
}
