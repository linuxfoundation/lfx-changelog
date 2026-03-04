// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Request, Response } from 'express';
import crypto from 'node:crypto';

import { serverLogger } from '../server-logger';
import { getPrismaClient } from '../services/prisma.service';
import { ReleaseService } from '../services/release.service';
import { SlackService } from '../services/slack.service';

import type { GitHubWebhookReleasePayload } from '@lfx-changelog/shared';

const WEBHOOK_STATE_SECRET = process.env['WEBHOOK_STATE_SECRET'] || '';

export class WebhookController {
  private readonly releaseService = new ReleaseService();
  private readonly slackService = new SlackService();
  /**
   * Signs a state payload for GitHub App install redirects.
   * Called when generating the install URL to embed a verifiable signature.
   */
  public static signState(payload: Record<string, unknown>): string {
    const data = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', WEBHOOK_STATE_SECRET).update(data).digest('hex');
    return Buffer.from(JSON.stringify({ d: data, s: hmac })).toString('base64url');
  }

  public async githubAppCallback(req: Request, res: Response): Promise<void> {
    const installationId = req.query['installation_id'] as string | undefined;
    const state = req.query['state'] as string | undefined;

    let productId = '';
    if (state) {
      try {
        const outer = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8')) as { d?: string; s?: string; productId?: string };

        // Support signed state (new format: { d, s }) and legacy unsigned format
        if (outer.d && outer.s) {
          const expectedHmac = crypto.createHmac('sha256', WEBHOOK_STATE_SECRET).update(outer.d).digest('hex');
          if (!crypto.timingSafeEqual(Buffer.from(outer.s, 'hex'), Buffer.from(expectedHmac, 'hex'))) {
            serverLogger.warn('GitHub callback state signature mismatch — possible CSRF');
            res.redirect('/admin/products');
            return;
          }
          const parsed = JSON.parse(outer.d) as { productId?: string };
          productId = parsed.productId || '';
        } else if (outer.productId) {
          // Legacy unsigned format — log a warning but still allow
          serverLogger.warn('GitHub callback received unsigned state — migrate to signed state');
          productId = outer.productId;
        }
      } catch {
        serverLogger.warn({ state }, 'Failed to parse GitHub callback state');
      }
    }

    if (!productId) {
      res.redirect('/admin/products');
      return;
    }

    const params = new URLSearchParams({ tab: 'repositories' });
    if (installationId) {
      params.set('installation_id', installationId);
    }

    res.redirect(`/admin/products/${encodeURIComponent(productId)}?${params.toString()}`);
  }

  /**
   * Handles incoming GitHub webhook events.
   * Signature verification is handled by the verifyGitHubWebhook middleware.
   */
  public async githubWebhook(req: Request, res: Response): Promise<void> {
    const event = req.headers['x-github-event'] as string;
    if (event !== 'release') {
      // Acknowledge non-release events silently
      res.status(200).json({ ok: true, ignored: true });
      return;
    }

    const body = req.body as { action: string; release: Record<string, unknown>; repository: { full_name: string } };
    const repoFullName = body.repository?.full_name;
    if (!repoFullName) {
      res.status(400).json({ error: 'Missing repository full_name' });
      return;
    }

    // Look up all ProductRepository entries by full name (a repo can be linked to multiple products)
    const prisma = getPrismaClient();
    const productRepos = await prisma.productRepository.findMany({
      where: { fullName: repoFullName },
    });

    if (productRepos.length === 0) {
      serverLogger.info({ repoFullName }, 'GitHub webhook release event for untracked repository — ignoring');
      res.status(200).json({ ok: true, ignored: true });
      return;
    }

    const releasePayload = body.release as GitHubWebhookReleasePayload;

    for (const productRepo of productRepos) {
      if (body.action === 'deleted') {
        await prisma.gitHubRelease.deleteMany({
          where: { repositoryId: productRepo.id, githubId: releasePayload.id },
        });
        serverLogger.info({ repoFullName, tag: releasePayload.tag_name }, 'Deleted release via webhook');
      } else {
        await this.releaseService.upsertFromWebhook(productRepo.id, releasePayload);
      }

      await prisma.productRepository.update({
        where: { id: productRepo.id },
        data: { lastSyncedAt: new Date() },
      });
    }

    res.status(200).json({ ok: true });
  }

  /**
   * GET /webhooks/slack-callback — Slack OAuth callback (unauthenticated).
   */
  public async slackOAuthCallback(req: Request, res: Response): Promise<void> {
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
