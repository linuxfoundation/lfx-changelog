// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { ContributorQueryParamsSchema, SlackUserSearchParamsSchema } from '@lfx-changelog/shared';
import { NextFunction, Request, Response } from 'express';

import { ContributorService } from '../services/contributor.service';
import { SlackService } from '../services/slack.service';

import type { LinkContributorSlackRequest, SyncContributorsRequest } from '@lfx-changelog/shared';

export class ContributorController {
  private readonly contributorService = new ContributorService();
  private readonly slackService = new SlackService();

  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Re-parse to get coerced/defaulted values (req.query is read-only in Express 5)
      const params = ContributorQueryParamsSchema.parse(req.query);
      const result = await this.contributorService.findAll(params);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const contributor = await this.contributorService.findById(req.params['id'] as string);
      res.json({ success: true, data: contributor });
    } catch (error) {
      next(error);
    }
  }

  public async sync(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId, repositoryId } = (req.body ?? {}) as SyncContributorsRequest;
      const result = await this.contributorService.sync({ productId, repositoryId });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  public async linkSlack(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slackUserId } = req.body as LinkContributorSlackRequest;
      const contributor = await this.contributorService.linkSlack(req.params['id'] as string, slackUserId, req.dbUser!.id);
      res.json({ success: true, data: contributor });
    } catch (error) {
      next(error);
    }
  }

  public async unlinkSlack(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const contributor = await this.contributorService.unlinkSlack(req.params['id'] as string);
      res.json({ success: true, data: contributor });
    } catch (error) {
      next(error);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.contributorService.delete(req.params['id'] as string, req.dbUser!.id);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }

  public async listSlackWorkspaceUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { query } = SlackUserSearchParamsSchema.parse(req.query);
      const users = await this.slackService.searchWorkspaceUsers(query);
      res.json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  }
}
