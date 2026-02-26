import { Request, Response } from 'express';

import { serverLogger } from '../server-logger';

export class WebhookController {
  public async githubAppCallback(req: Request, res: Response): Promise<void> {
    const installationId = req.query['installation_id'] as string | undefined;
    const state = req.query['state'] as string | undefined;

    let productId = '';
    if (state) {
      try {
        const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8')) as { productId?: string };
        productId = parsed.productId || '';
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
