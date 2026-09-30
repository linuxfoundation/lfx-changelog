// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { AngularNodeAppEngine, writeResponseToNodeResponse } from '@angular/ssr/node';

import { ssrCacheMiddleware } from '../middleware/cache.middleware';
import { serverLogger } from '../server-logger';
import { UserService } from '../services/user.service';

import type { AuthContext, RuntimeConfig } from '@lfx-changelog/shared';
import type { Express, NextFunction, Request, Response } from 'express';

/**
 * The proxy headers traefik puts in front of this app. Angular keeps its own allowlist, separate
 * from Express's `trust proxy`, and since @angular/ssr 20.3.37 *any* `x-forwarded-*` header that
 * is not on it makes the engine serve the client shell instead of rendering — an empty
 * `<lfx-root>`, so no markup, no injected auth context and no runtime config reach the browser.
 * It is silent apart from a warning on stderr.
 *
 * Every forwarded header traefik sends therefore has to be listed, including the ones Angular
 * never reads — omitting two of them is what took production down. `true` would not do it either:
 * Angular's built-in set omits `x-forwarded-server`, which traefik does send. `x-forwarded-prefix`
 * is left off on purpose, as the canary for traefik growing a header we have not accounted for;
 * the e2e suite pins that failure mode rather than hiding it.
 *
 * `x-forwarded-host` is the entry with a security cost, since the request URL is built from it and
 * a proxy that does not overwrite it is an SSRF vector. It is safe here only because the engine
 * re-checks it against `allowedHosts`, which every deployed environment supplies through
 * `NG_ALLOWED_HOSTS`. Passing this option means that variable's sibling, `NG_TRUST_PROXY_HEADERS`,
 * is ignored — the engine resolves `options ?? env`, so there is no per-environment override.
 */
const TRUSTED_PROXY_HEADERS = ['x-forwarded-for', 'x-forwarded-host', 'x-forwarded-port', 'x-forwarded-proto', 'x-forwarded-server'];

const angularApp = new AngularNodeAppEngine({ trustProxyHeaders: TRUSTED_PROXY_HEADERS });
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
              deactivatedAt: prismaUser.deactivatedAt?.toISOString() ?? null,
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
      baseUrl: (process.env['BASE_URL'] || 'http://localhost:4204').replace(/\/+$/, ''),
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
