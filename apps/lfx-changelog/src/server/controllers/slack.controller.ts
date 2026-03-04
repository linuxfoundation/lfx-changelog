// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { SlackService } from '../services/slack.service';

import type { NextFunction, Request, Response } from 'express';

export class SlackController {
  private readonly slackService = new SlackService();

  /**
   * GET /api/slack/connect — returns OAuth URL and redirects browser to Slack.
   */
  public async connect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.dbUser!.id;
      const url = this.slackService.getOAuthUrl(userId);
      res.json({ success: true, data: { url } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/slack/integrations — list user's Slack integrations.
   */
  public async getIntegrations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.dbUser!.id;
      const integrations = await this.slackService.getIntegrations(userId);
      // Map to shared schema shape — never expose tokens or internal fields
      const safe = integrations.map((integration) => ({
        id: integration.id,
        teamId: integration.teamId,
        teamName: integration.teamName,
        slackUserId: integration.slackUserId,
        scope: integration.scope,
        status: integration.status,
        tokenExpiresAt: integration.tokenExpiresAt.toISOString(),
        connectedAt: integration.connectedAt.toISOString(),
        channels: integration.channels.map((ch) => ({
          id: ch.id,
          channelId: ch.channelId,
          channelName: ch.channelName,
          isDefault: ch.isDefault,
          createdAt: ch.createdAt.toISOString(),
        })),
      }));
      res.json({ success: true, data: safe });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/slack/integrations/:id/channels — get Slack channels for an integration.
   */
  public async getChannels(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const channels = await this.slackService.getChannels(req.dbUser!.id, req.params['id'] as string);
      res.json({ success: true, data: channels });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/slack/integrations/:id/channels — save a default channel.
   */
  public async saveChannel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { channelId, channelName } = req.body as { channelId: string; channelName: string };
      const channel = await this.slackService.saveChannel(req.dbUser!.id, req.params['id'] as string, channelId, channelName);
      res.json({ success: true, data: channel });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/slack/integrations/:id — disconnect a Slack integration.
   */
  public async disconnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.dbUser!.id;
      await this.slackService.disconnect(userId, req.params['id'] as string);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
}
