// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { GITHUB_APP_INSTALL_URL } from '@lfx-changelog/shared/constants/github.constant';
import { NextFunction, Request, Response } from 'express';

import { WebhookController } from './webhook.controller';

import { GitHubService } from '../services/github.service';

export class GitHubController {
  private readonly githubService = new GitHubService();

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
}
