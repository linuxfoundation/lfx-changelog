// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { SearchQueryParamsSchema } from '@lfx-changelog/shared';

import { getOpenSearchClient } from '../services/opensearch.service';
import { SearchService } from '../services/search.service';

import type { NextFunction, Request, Response } from 'express';

export class SearchController {
  private readonly searchService = new SearchService();

  public async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!getOpenSearchClient()) {
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

  public async reindex(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!getOpenSearchClient()) {
        res.status(503).json({ success: false, error: 'OpenSearch is not configured' });
        return;
      }
      const result = await this.searchService.reindexAll();
      res.json({ success: true, data: result });
    } catch (error) {
      if (this.isOpenSearchConnectionError(error)) {
        res.status(503).json({ success: false, error: 'OpenSearch is currently unavailable' });
        return;
      }
      next(error);
    }
  }

  private isOpenSearchConnectionError(error: unknown): boolean {
    const name = (error as { name?: string })?.name;
    return name === 'ConnectionError' || name === 'TimeoutError' || name === 'NoLivingConnectionsError';
  }
}
