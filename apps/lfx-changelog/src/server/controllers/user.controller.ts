// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { UserRole } from '@lfx-changelog/shared';
import { User as PrismaUser } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';

import { UserService } from '../services/user.service';

import type { CreateUserRequest } from '@lfx-changelog/shared';

function mapUser(prismaUser: PrismaUser & { userRoleAssignments?: any[] }) {
  const { userRoleAssignments, ...rest } = prismaUser;
  return { ...rest, roles: userRoleAssignments || [] };
}

export class UserController {
  private readonly userService = new UserService();

  public async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dbUser = (req as any).dbUser;
      res.json({ success: true, data: mapUser(dbUser) });
    } catch (error) {
      next(error);
    }
  }

  public async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await this.userService.findAll();
      res.json({ success: true, data: users.map(mapUser) });
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, name, role, productId } = req.body as CreateUserRequest;
      const user = await this.userService.create({ email, name });
      await this.userService.assignRole(user.id, role, productId ?? null);

      const fullUser = await this.userService.findById(user.id);
      res.status(201).json({ success: true, data: mapUser(fullUser) });
    } catch (error) {
      next(error);
    }
  }

  public async assignRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { role, productId } = req.body;
      const validRoles = Object.values(UserRole) as string[];
      if (!role || !validRoles.includes(role)) {
        res.status(400).json({ success: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
        return;
      }
      const assignment = await this.userService.assignRole(req.params['id'] as string, role, productId ?? null);
      res.status(201).json({ success: true, data: assignment });
    } catch (error) {
      next(error);
    }
  }

  public async removeRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.userService.removeRole(req.params['roleId'] as string);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
}
