// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { GITHUB_APP_INSTALL_URL } from '@lfx-changelog/shared/constants/github.constant';
import { NextFunction, Request, Response } from 'express';

import { WebhookController } from './webhook.controller';

import { GitHubService } from '../services/github.service';
import { ProductService } from '../services/product.service';

export class GitHubController {
  private readonly githubService = new GitHubService();
  private readonly productService = new ProductService();

  public async listInstallations(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const installations = await this.githubService.getInstallations();
      res.json({ success: true, data: installations });
    } catch (error) {
      next(error);
    }
  }

  public async listInstallationRepositories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const installationId = parseInt(req.params['installationId'] as string, 10);
      const repositories = await this.githubService.getInstallationRepositories(installationId);
      res.json({ success: true, data: repositories });
    } catch (error) {
      next(error);
    }
  }

  public getInstallUrl(req: Request, res: Response, next: NextFunction): void {
    try {
      const productId = req.query['productId'] as string | undefined;
      if (!productId) {
        res.status(400).json({ success: false, error: 'productId query parameter is required' });
        return;
      }

      const state = WebhookController.signState({ productId });
      const baseUrl = process.env['BASE_URL'] || `${req.protocol}://${req.get('host')}`;
      const redirectUrl = `${baseUrl}/webhooks/github-app-callback`;
      const url = `${GITHUB_APP_INSTALL_URL}?state=${encodeURIComponent(state)}&redirect_url=${encodeURIComponent(redirectUrl)}`;

      res.json({ success: true, data: url });
    } catch (error) {
      next(error);
    }
  }

  // ── Release operations ───────────────────────────

  public async listPublicReleases(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : undefined;
      const productId = req.query['productId'] as string | undefined;

      const releases = await this.githubService.findAllPublicReleases({ limit, productId });
      res.json({ success: true, data: releases });
    } catch (error) {
      next(error);
    }
  }

  public async syncReleases(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = req.params['productId'] as string;
      const synced = await this.githubService.syncReleasesForProduct(productId);
      res.json({ success: true, data: { synced } });
    } catch (error) {
      next(error);
    }
  }

  public async syncRepositoryReleases(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const repoId = req.params['repoId'] as string;
      const repo = await this.productService.findRepositoryById(repoId);
      const synced = await this.githubService.syncReleasesForRepository(repo);
      res.json({ success: true, data: { synced } });
    } catch (error) {
      next(error);
    }
  }

  public async listRepositoriesWithCounts(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const repos = await this.productService.findAllRepositoriesWithCounts();
      res.json({ success: true, data: repos });
    } catch (error) {
      next(error);
    }
  }
}
