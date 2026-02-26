// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { ROLE_HIERARCHY, UserRole } from '@lfx-changelog/shared';
import { NextFunction, Request, Response } from 'express';

import { AuthorizationError, NotFoundError } from '../errors';
import { getPrismaClient } from '../services/prisma.service';

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
    const productId = (req as any).resolvedProductId || req.body?.productId;

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

/**
 * Middleware that resolves the productId from a changelog entry ID in req.params['id'].
 * Must be placed before requireProductRole on changelog routes where :id is the entry ID.
 */
export function resolveChangelogProductId(req: Request, _res: Response, next: NextFunction): void {
  const entryId = req.params['id'] as string;
  if (!entryId) {
    next();
    return;
  }

  const prisma = getPrismaClient();
  prisma.changelogEntry
    .findUnique({ where: { id: entryId }, select: { productId: true } })
    .then((entry) => {
      if (!entry) {
        next(new NotFoundError(`Changelog entry not found: ${entryId}`, { operation: 'resolveProductId', service: 'changelog' }));
        return;
      }
      (req as any).resolvedProductId = entry.productId;
      next();
    })
    .catch(next);
}
