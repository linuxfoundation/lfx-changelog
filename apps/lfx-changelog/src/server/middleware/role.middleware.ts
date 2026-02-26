import { ROLE_HIERARCHY, UserRole } from '@lfx-changelog/shared';
import { NextFunction, Request, Response } from 'express';

import { AuthorizationError } from '../errors';

export function requireRole(minimumRole: UserRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const dbUser = (req as any).dbUser;
    if (!dbUser) {
      next(new AuthorizationError('No user context available', { path: req.path }));
      return;
    }

    const minimumLevel = ROLE_HIERARCHY[minimumRole];
    const userRoles = dbUser.userRoleAssignments || [];

    const hasPermission = userRoles.some((assignment: any) => {
      const roleLevel = ROLE_HIERARCHY[assignment.role as UserRole];
      return roleLevel !== undefined && roleLevel >= minimumLevel;
    });

    if (!hasPermission) {
      next(new AuthorizationError(`Requires ${minimumRole} role or higher`, { path: req.path }));
      return;
    }

    next();
  };
}

export function requireProductRole(minimumRole: UserRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const dbUser = (req as any).dbUser;
    if (!dbUser) {
      next(new AuthorizationError('No user context available', { path: req.path }));
      return;
    }

    const minimumLevel = ROLE_HIERARCHY[minimumRole];
    const userRoles = dbUser.userRoleAssignments || [];
    const productId = req.params['id'] || req.body?.productId;

    const isSuperAdmin = userRoles.some((assignment: any) => assignment.role === UserRole.SUPER_ADMIN);
    if (isSuperAdmin) {
      next();
      return;
    }

    const hasProductPermission = userRoles.some((assignment: any) => {
      const roleLevel = ROLE_HIERARCHY[assignment.role as UserRole];
      return roleLevel !== undefined && roleLevel >= minimumLevel && (assignment.productId === null || assignment.productId === productId);
    });

    if (!hasProductPermission) {
      next(new AuthorizationError(`Requires ${minimumRole} role or higher for this product`, { path: req.path }));
      return;
    }

    next();
  };
}
