// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { NextFunction, Request, Response } from 'express';

import { ReleaseService } from '../services/release.service';

import type { CreateReleaseRequest, GenerateReleaseNotesRequest } from '@lfx-changelog/shared';

export class ReleaseController {
  private readonly releaseService = new ReleaseService();

  public async getReleaseTarget(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const target = await this.releaseService.getReleaseTarget(req.params['repoId'] as string, req.dbUser!);
      res.json({ success: true, data: target });
    } catch (error) {
      next(error);
    }
  }

  public async previewNotes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tagName, targetCommitish } = req.body as GenerateReleaseNotesRequest;
      const notes = await this.releaseService.previewNotes(req.params['repoId'] as string, tagName, targetCommitish, req.dbUser!);
      res.json({ success: true, data: notes });
    } catch (error) {
      next(error);
    }
  }

  public async createRelease(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const release = await this.releaseService.createRelease(req.params['repoId'] as string, req.body as CreateReleaseRequest, req.dbUser!);
      res.status(201).json({ success: true, data: release });
    } catch (error) {
      next(error);
    }
  }
}
