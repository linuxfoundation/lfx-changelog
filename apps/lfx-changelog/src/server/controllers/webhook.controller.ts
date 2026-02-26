// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Request, Response } from 'express';
import crypto from 'node:crypto';

import { serverLogger } from '../server-logger';

const WEBHOOK_STATE_SECRET = process.env['WEBHOOK_STATE_SECRET'] || process.env['AUTH0_SECRET'] || '';

export class WebhookController {
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
}
