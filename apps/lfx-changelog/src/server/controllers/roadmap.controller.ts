// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { roadmapService } from '../services/roadmap.service';

import type { NextFunction, Request, Response } from 'express';

export class RoadmapController {
  public async getBoard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const team = req.query['team'] as string | undefined;
      const includeCompleted = req.query['includeCompleted'] === 'true';
      const board = await roadmapService.getBoard(team, includeCompleted);
      res.json({ success: true, data: board });
    } catch (error) {
      next(error);
    }
  }

  public async getIdea(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jiraKey = req.params['jiraKey'] as string;
      const idea = await roadmapService.getIdea(jiraKey);
      if (!idea) {
        res.status(404).json({ success: false, error: 'Roadmap idea not found' });
        return;
      }
      res.json({ success: true, data: idea });
    } catch (error) {
      next(error);
    }
  }

  public async getComments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jiraKey = req.params['jiraKey'] as string;
      const comments = await roadmapService.getComments(jiraKey);
      res.json({ success: true, data: comments });
    } catch (error) {
      next(error);
    }
  }
}
