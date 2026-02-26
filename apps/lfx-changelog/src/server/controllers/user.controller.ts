import { NextFunction, Request, Response } from 'express';

import { UserService } from '../services/user.service';

export class UserController {
  private readonly userService = new UserService();

  public async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dbUser = (req as any).dbUser;
      res.json({ success: true, data: dbUser });
    } catch (error) {
      next(error);
    }
  }

  public async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await this.userService.findAll();
      res.json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  }

  public async assignRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { role, productId } = req.body;
      const assignment = await this.userService.assignRole(req.params['id'] as string, role, productId ?? null);
      res.status(201).json({ success: true, data: assignment });
    } catch (error) {
      next(error);
    }
  }

  public async removeRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.userService.removeRole(req.params['roleId'] as string);
      res.json({ success: true, data: null, message: 'Role removed' });
    } catch (error) {
      next(error);
    }
  }
}
