// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { NextFunction, Request, Response } from 'express';

import { ReleasableServiceService } from '../services/releasable-service.service';

import type { UserRoleAssignment } from '@prisma/client';

export class ReleasableServiceController {
  private readonly releasableServiceService = new ReleasableServiceService();

  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const services = await this.releasableServiceService.findReleasable(this.getUserRoles(req));
      res.json({ success: true, data: services });
    } catch (error) {
      next(error);
    }
  }

  private getUserRoles(req: Request): UserRoleAssignment[] {
    return req.dbUser?.userRoleAssignments ?? [];
  }
}
