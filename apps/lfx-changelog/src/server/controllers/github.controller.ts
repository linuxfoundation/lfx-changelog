// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { NextFunction, Request, Response } from 'express';

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
}
