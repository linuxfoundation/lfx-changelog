// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { NextFunction, Request, Response } from 'express';

import { ReleaseService } from '../services/release.service';

import type { CreateReleaseRequest, GenerateReleaseNotesRequest } from '@lfx-changelog/shared';
import type { UserRoleAssignment } from '@prisma/client';

export class ReleaseController {
  private readonly releaseService = new ReleaseService();

  public async getReleaseTarget(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const target = await this.releaseService.getReleaseTarget(req.params['repoId'] as string, this.getUserRoles(req));
      res.json({ success: true, data: target });
    } catch (error) {
      next(error);
    }
  }

  public async previewNotes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tagName, targetCommitish } = req.body as GenerateReleaseNotesRequest;
      const notes = await this.releaseService.previewNotes(req.params['repoId'] as string, tagName, targetCommitish, this.getUserRoles(req));
      res.json({ success: true, data: notes });
    } catch (error) {
      next(error);
    }
  }

  public async createRelease(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const release = await this.releaseService.createRelease(
        req.params['repoId'] as string,
        req.body as CreateReleaseRequest,
        this.getUserRoles(req),
        req.dbUser!.id
      );
      res.status(201).json({ success: true, data: release });
    } catch (error) {
      next(error);
    }
  }

  private getUserRoles(req: Request): UserRoleAssignment[] {
    return req.dbUser?.userRoleAssignments ?? [];
  }
}
