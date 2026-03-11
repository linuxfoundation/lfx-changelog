// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { SearchQueryParamsSchema } from '@lfx-changelog/shared';

import { SearchService } from '../services/search.service';

import type { NextFunction, Request, Response } from 'express';

type ReindexTarget = 'changelogs' | 'blogs' | 'all';
const VALID_REINDEX_TARGETS = new Set<ReindexTarget>(['changelogs', 'blogs', 'all']);

export class SearchController {
  private readonly searchService = new SearchService();

  public async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!this.searchService.getClient()) {
        res.status(503).json({ success: false, error: 'Search is currently unavailable' });
        return;
      }
      // Re-parse to get coerced/defaulted values (req.query is read-only in Express 5)
      const params = SearchQueryParamsSchema.parse(req.query);
      const result = await this.searchService.search(params);
      res.json(result);
    } catch (error) {
      if (this.isOpenSearchConnectionError(error)) {
        res.status(503).json({ success: false, error: 'Search is currently unavailable' });
        return;
      }
      next(error);
    }
  }

  public async reindex(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!this.searchService.getClient()) {
        res.status(503).json({ success: false, error: 'OpenSearch is not configured' });
        return;
      }

      const target = this.parseReindexTarget(req.query['target'] as string | undefined);
      if (target === null) {
        res.status(400).json({ success: false, error: 'Invalid target. Must be one of: changelogs, blogs, all' });
        return;
      }

      const results: Record<string, { indexed: number; errors: number }> = {};
      if (target === 'changelogs' || target === 'all') {
        results['changelogs'] = await this.searchService.reindexAll();
      }
      if (target === 'blogs' || target === 'all') {
        results['blogs'] = await this.searchService.reindexAllBlogs();
      }

      res.json({ success: true, data: results });
    } catch (error) {
      if (this.isOpenSearchConnectionError(error)) {
        res.status(503).json({ success: false, error: 'OpenSearch is currently unavailable' });
        return;
      }
      next(error);
    }
  }

  private parseReindexTarget(raw: string | undefined): ReindexTarget | null {
    if (!raw) return 'all';
    const normalized = raw.toLowerCase() as ReindexTarget;
    return VALID_REINDEX_TARGETS.has(normalized) ? normalized : null;
  }

  private isOpenSearchConnectionError(error: unknown): boolean {
    const name = (error as { name?: string })?.name;
    return name === 'ConnectionError' || name === 'TimeoutError' || name === 'NoLivingConnectionsError';
  }
}
