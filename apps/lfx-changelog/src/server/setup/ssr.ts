// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { AngularNodeAppEngine, writeResponseToNodeResponse } from '@angular/ssr/node';

import { ssrCacheMiddleware } from '../middleware/cache.middleware';
import { serverLogger } from '../server-logger';
import { UserService } from '../services/user.service';

import type { AuthContext, RuntimeConfig } from '@lfx-changelog/shared';
import type { Express, NextFunction, Request, Response } from 'express';

const angularApp = new AngularNodeAppEngine();
const userService = new UserService();

/**
 * Registers the Angular SSR catch-all handler and the global error handler.
 * Builds the auth context from the OIDC session and passes it to Angular.
 */
export function setupSsr(app: Express): void {
  // SSR cache headers — must run before Angular renders to set headers on the response
  app.use(ssrCacheMiddleware);

  // Angular SSR catch-all
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    const authContext: AuthContext = {
      authenticated: false,
      user: null,
      dbUser: null,
    };

    if (req.oidc?.isAuthenticated()) {
      authContext.authenticated = true;
      const oidcUser = req.oidc.user;
      if (oidcUser) {
        authContext.user = {
          sub: oidcUser['sub'],
          email: oidcUser['email'],
          name: oidcUser['name'] || oidcUser['email'],
          picture: oidcUser['picture'] || '',
        };
        try {
          const prismaUser = await userService.findByEmail(authContext.user.email);
          if (prismaUser) {
            authContext.dbUser = {
              id: prismaUser.id,
              auth0Id: prismaUser.auth0Id,
              email: prismaUser.email,
              name: prismaUser.name,
              avatarUrl: prismaUser.avatarUrl || '',
              createdAt: prismaUser.createdAt.toISOString(),
              updatedAt: prismaUser.updatedAt.toISOString(),
              roles: ((prismaUser as any).userRoleAssignments || []).map((r: any) => ({
                id: r.id,
                userId: r.userId,
                productId: r.productId,
                role: r.role,
              })),
            };
          }
        } catch {
          serverLogger.warn('Failed to look up user during SSR, continuing without dbUser');
        }
      }
    }

    const runtimeConfig: RuntimeConfig = {
      dataDogRumClientId: process.env['DD_RUM_CLIENT_ID'] || '',
      dataDogRumApplicationId: process.env['DD_RUM_APPLICATION_ID'] || '',
    };

    angularApp
      .handle(req, { auth: authContext, runtimeConfig })
      .then((response) => {
        if (response) {
          return writeResponseToNodeResponse(response, res);
        }
        return next();
      })
      .catch(next);
  });

  // Global error handler
  app.use((error: Error, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    serverLogger.error({ err: error }, 'Unhandled error');
    res.status(500).json({ error: 'Internal Server Error' });
  });
}
