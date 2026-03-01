// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { auth } from 'express-openid-connect';

import type { Express, Request, Response } from 'express';

/**
 * Registers Auth0 OIDC middleware and custom `/login` + `/logout` routes.
 */
export function setupAuth(app: Express): void {
  // OIDC (Auth0)
  app.use(
    auth({
      authRequired: false,
      auth0Logout: true,
      baseURL: process.env['BASE_URL'] || 'http://localhost:4204',
      clientID: process.env['AUTH0_CLIENT_ID'] || '1234',
      issuerBaseURL: process.env['AUTH0_ISSUER_BASE_URL'] || 'https://example.com',
      secret: process.env['AUTH0_SECRET'] || 'a-long-random-secret-for-dev',
      idTokenSigningAlg: 'HS256',
      authorizationParams: {
        response_type: 'code',
        scope: 'openid email profile offline_access',
      },
      clientSecret: process.env['AUTH0_CLIENT_SECRET'] || 'CHANGE_ME_AUTH0_CLIENT_SECRET',
      routes: {
        login: false,
      },
    })
  );

  // Custom login route with returnTo
  app.get('/login', (req: Request, res: Response) => {
    const returnTo = (req.query['returnTo'] as string) || '/';
    const safeReturnTo = returnTo.startsWith('/') ? returnTo : '/';
    (res as any).oidc.login({ returnTo: safeReturnTo });
  });

  // Custom logout route
  app.get('/logout', (_req: Request, res: Response) => {
    (res as any).oidc.logout({ returnTo: '/' });
  });
}
