// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { NextFunction, Request, Response } from 'express';

import { serverLogger } from '../server-logger';
import { GitHubService } from '../services/github.service';
import { ProductService } from '../services/product.service';

import type { GitHubCommit, GitHubPullRequest, GitHubRelease, LinkRepositoryRequest, ProductActivity } from '@lfx-changelog/shared';

export class ProductController {
  private readonly productService = new ProductService();
  private readonly githubService = new GitHubService();

  public async listPublic(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const products = await this.productService.findAllPublic();
      res.json({ success: true, data: products });
    } catch (error) {
      next(error);
    }
  }

  public async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const products = await this.productService.findAll();
      res.json({ success: true, data: products });
    } catch (error) {
      next(error);
    }
  }

  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await this.productService.findById(req.params['id'] as string);
      res.json({ success: true, data: product });
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, slug, description, iconUrl, faIcon } = req.body;
      const product = await this.productService.create({ name, slug, description, iconUrl, faIcon });
      res.status(201).json({ success: true, data: product });
    } catch (error) {
      next(error);
    }
  }

  public async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await this.productService.update(req.params['id'] as string, req.body);
      res.json({ success: true, data: product });
    } catch (error) {
      next(error);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.productService.delete(req.params['id'] as string);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }

  // ── Repository operations ───────────────────────────

  public async listRepositories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = req.params['id'] as string;
      const repositories = await this.productService.findRepositoriesByProductId(productId);
      res.json({ success: true, data: repositories });
    } catch (error) {
      next(error);
    }
  }

  public async linkRepository(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = req.params['id'] as string;
      const data = req.body as LinkRepositoryRequest;
      const repository = await this.productService.linkRepository(productId, data);
      res.status(201).json({ success: true, data: repository });
    } catch (error) {
      next(error);
    }
  }

  public async unlinkRepository(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = req.params['id'] as string;
      const repoId = req.params['repoId'] as string;
      await this.productService.unlinkRepository(productId, repoId);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }

  public async getActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = req.params['id'] as string;
      const repos = await this.productService.findRepositoriesByProductId(productId);
      serverLogger.info({ productId, repoCount: repos.length }, 'Fetching activity for product');

      if (repos.length === 0) {
        const empty: ProductActivity = { releases: [], pullRequests: [], commits: [] };
        res.json({ success: true, data: empty });
        return;
      }

      const results = await Promise.all(
        repos.map(async (repo) => {
          try {
            serverLogger.info({ repo: repo.fullName, installationId: repo.githubInstallationId }, 'Fetching activity for repo');
            const [releases, pulls, commits] = await Promise.all([
              this.githubService.getRepositoryReleases(repo.githubInstallationId, repo.owner, repo.name, repo.fullName),
              this.githubService.getRepositoryPullRequests(repo.githubInstallationId, repo.owner, repo.name, repo.fullName),
              this.githubService.getRepositoryCommits(repo.githubInstallationId, repo.owner, repo.name, repo.fullName),
            ]);
            serverLogger.info({ repo: repo.fullName, releases: releases.length, pulls: pulls.length, commits: commits.length }, 'Fetched activity for repo');
            return { releases, pulls, commits };
          } catch (error) {
            serverLogger.error({ repo: repo.fullName, error }, 'Failed to fetch activity for repository');
            return { releases: [] as GitHubRelease[], pulls: [] as GitHubPullRequest[], commits: [] as GitHubCommit[] };
          }
        })
      );

      const allReleases = results
        .flatMap((r) => r.releases)
        .sort((a, b) => new Date(b.published_at || '').getTime() - new Date(a.published_at || '').getTime());
      const allPulls = results.flatMap((r) => r.pulls).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      const allCommits = results.flatMap((r) => r.commits).sort((a, b) => new Date(b.commit.author.date).getTime() - new Date(a.commit.author.date).getTime());

      const activity: ProductActivity = { releases: allReleases, pullRequests: allPulls, commits: allCommits };
      res.json({ success: true, data: activity });
    } catch (error) {
      next(error);
    }
  }

}
