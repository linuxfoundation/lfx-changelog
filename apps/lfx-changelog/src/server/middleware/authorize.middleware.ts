// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { ROLE_HIERARCHY, UserRole } from '@lfx-changelog/shared';
import { NextFunction, Request, Response } from 'express';

import { AuthorizationError, NotFoundError } from '../errors';
import { ApiKeyService } from '../services/api-key.service';
import { getPrismaClient } from '../services/prisma.service';

import type { ApiKeyScope } from '@lfx-changelog/shared';
import type { UserRoleAssignment } from '@prisma/client';

interface AuthorizeOptions {
  /** API key scope required. API keys are rejected if omitted. */
  scope?: ApiKeyScope;
  /** Global role check (OAuth only). */
  role?: UserRole;
  /** Product-scoped role check (OAuth only). */
  productRole?: UserRole;
  /** Resolve product ID from changelog entry :id param before productRole check. */
  resolveProductId?: boolean;
  /** Reject API key auth entirely + check Origin on mutations (POST/DELETE). */
  oauthOnly?: boolean;
}

const apiKeyService = new ApiKeyService();

/**
 * Unified authorization middleware factory.
 *
 * Replaces the separate `requireScope`, `requireRole`, `requireProductRole`,
 * `resolveChangelogProductId`, and `oauthOnlyGuard` middleware with a single
 * declarative call.
 */
export function authorize(options: AuthorizeOptions = {}) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      // ── oauthOnly: reject API keys, check Origin on mutations ──
      if (options.oauthOnly) {
        if (req.authMethod === 'api_key') {
          next(new AuthorizationError('This endpoint requires browser session authentication', { path: req.path }));
          return;
        }

        if (req.method !== 'GET' && req.method !== 'HEAD') {
          const origin = req.headers['origin'];
          const baseUrl = (process.env['BASE_URL'] || 'http://localhost:4204').replace(/\/$/, '');

          let originMatch = false;
          try {
            originMatch = !!origin && new URL(origin).origin === new URL(baseUrl).origin;
          } catch {
            // Malformed Origin header — treat as missing
          }

          if (!originMatch) {
            next(new AuthorizationError('This action is only available from the application UI', { path: req.path }));
            return;
          }
        }

        next();
        return;
      }

      // ── API key path ──
      if (req.authMethod === 'api_key') {
        if (!options.scope) {
          next(new AuthorizationError('API keys cannot access this endpoint', { path: req.path }));
          return;
        }

        if (!req.apiKey) {
          next(new AuthorizationError('No API key context available', { path: req.path }));
          return;
        }

        if (!apiKeyService.hasScope(req.apiKey, options.scope)) {
          next(new AuthorizationError(`API key missing required scope: ${options.scope}`, { path: req.path }));
          return;
        }

        next();
        return;
      }

      // ── OAuth path ──

      // resolveProductId: look up changelog entry → productId
      if (options.resolveProductId) {
        const entryId = req.params['id'] as string;
        if (entryId) {
          const prisma = getPrismaClient();
          const entry = await prisma.changelogEntry.findUnique({ where: { id: entryId }, select: { productId: true } });
          if (!entry) {
            next(new NotFoundError(`Changelog entry not found: ${entryId}`, { operation: 'resolveProductId', service: 'changelog' }));
            return;
          }
          req.resolvedProductId = entry.productId;
        }
      }

      // Both productRole and role checks require a user context
      if ((options.productRole || options.role) && !req.dbUser) {
        next(new AuthorizationError('No user context available', { path: req.path }));
        return;
      }

      // productRole: product-scoped role check with SUPER_ADMIN bypass
      if (options.productRole) {
        const minimumLevel = ROLE_HIERARCHY[options.productRole];
        const userRoles = req.dbUser!.userRoleAssignments || [];
        const productId = req.resolvedProductId || req.body?.productId || (req.query['productId'] as string);

        const isSuperAdmin = userRoles.some((a: UserRoleAssignment) => a.role === UserRole.SUPER_ADMIN);
        if (!isSuperAdmin) {
          const hasProductPermission = userRoles.some((a: UserRoleAssignment) => {
            const roleLevel = ROLE_HIERARCHY[a.role as UserRole];
            return roleLevel !== undefined && roleLevel >= minimumLevel && (a.productId === null || a.productId === productId);
          });

          if (!hasProductPermission) {
            next(new AuthorizationError(`Requires ${options.productRole} role or higher for this product`, { path: req.path }));
            return;
          }
        }
      }

      // role: global role hierarchy check
      if (options.role) {
        const minimumLevel = ROLE_HIERARCHY[options.role];
        const userRoles = req.dbUser!.userRoleAssignments || [];

        const hasPermission = userRoles.some((a: UserRoleAssignment) => {
          const roleLevel = ROLE_HIERARCHY[a.role as UserRole];
          return roleLevel !== undefined && roleLevel >= minimumLevel;
        });

        if (!hasPermission) {
          next(new AuthorizationError(`Requires ${options.role} role or higher`, { path: req.path }));
          return;
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
