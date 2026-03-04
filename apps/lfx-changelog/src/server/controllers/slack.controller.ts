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
      // Strip encrypted tokens from response
      const safe = integrations.map((integration) => {
        const { accessToken, refreshToken, ...rest } = integration;
        void accessToken;
        void refreshToken;
        return rest;
      });
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
      const channels = await this.slackService.getChannels(req.params['id'] as string);
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
      const channel = await this.slackService.saveChannel(req.params['id'] as string, channelId, channelName);
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

  /**
   * GET /webhooks/slack-callback — OAuth callback (unauthenticated).
   */
  public async oauthCallback(req: Request, res: Response): Promise<void> {
    const code = req.query['code'] as string | undefined;
    const state = req.query['state'] as string | undefined;
    const error = req.query['error'] as string | undefined;

    if (error) {
      res.redirect('/admin/settings?slack_error=access_denied');
      return;
    }

    if (!code || !state) {
      res.redirect('/admin/settings?slack_error=missing_params');
      return;
    }

    try {
      await this.slackService.handleOAuthCallback(code, state);
      res.redirect('/admin/settings?slack_connected=true');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.redirect(`/admin/settings?slack_error=${encodeURIComponent(message)}`);
    }
  }
}
