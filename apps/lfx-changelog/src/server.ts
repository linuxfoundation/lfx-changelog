import { AngularNodeAppEngine, createNodeRequestHandler, isMainModule, writeResponseToNodeResponse } from '@angular/ssr/node';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import { auth } from 'express-openid-connect';
import pinoHttp from 'pino-http';

import type { AuthContext } from '@lfx-changelog/shared';
import { authMiddleware } from './server/middleware/auth.middleware';
import { apiErrorHandler } from './server/middleware/error-handler.middleware';
import changelogRouter from './server/routes/changelog.route';
import productRouter from './server/routes/product.route';
import publicChangelogRouter from './server/routes/public-changelog.route';
import publicProductRouter from './server/routes/public-product.route';
import userRouter from './server/routes/user.route';
import { serverLogger } from './server/server-logger';
import { UserService } from './server/services/user.service';

if (process.env['NODE_ENV'] !== 'production') {
  dotenv.config();
}

const browserDistFolder = import.meta.dirname + '/../browser';

const angularApp = new AngularNodeAppEngine();
const app = express();
const userService = new UserService();

// 1. Compression
// eslint-disable-next-line @typescript-eslint/no-require-imports
const compression = require('compression');
app.use(
  compression({
    level: 6,
    threshold: 1024,
  })
);

// 2. Body parsers
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// 3. Static files
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  })
);

// 4. Health check
app.get('/health', (_req: Request, res: Response) => {
  res.send('OK');
});

// 5. Pino HTTP logger
app.use(
  pinoHttp({
    logger: serverLogger,
    autoLogging: {
      ignore: (req) => {
        const url = (req as Request).originalUrl || (req as Request).url;
        return url === '/health' || url.startsWith('/assets');
      },
    },
  })
);

// 6. OIDC (Auth0)
app.use(
  auth({
    authRequired: false,
    auth0Logout: true,
    baseURL: process.env['BASE_URL'] || 'http://localhost:4204',
    clientID: process.env['AUTH0_CLIENT_ID'] || '',
    issuerBaseURL: process.env['AUTH0_ISSUER_BASE_URL'] || '',
    secret: process.env['AUTH0_SECRET'] || 'a-long-random-secret-for-dev',
    idTokenSigningAlg: 'HS256',
    authorizationParams: {
      response_type: 'code',
      audience: process.env['AUTH0_AUDIENCE'] || '',
      scope: 'openid email profile api offline_access',
    },
    clientSecret: process.env['AUTH0_CLIENT_SECRET'] || '',
    routes: {
      login: false,
    },
  })
);

// 7. Custom login route with returnTo
app.get('/login', (req: Request, res: Response) => {
  const returnTo = (req.query['returnTo'] as string) || '/';
  const safeReturnTo = returnTo.startsWith('/') ? returnTo : '/';
  (res as any).oidc.login({ returnTo: safeReturnTo });
});

// 7b. Custom logout route
app.get('/logout', (_req: Request, res: Response) => {
  (res as any).oidc.logout({ returnTo: '/' });
});

// 8. Public API routes (no auth required)
app.use('/public/api/changelogs', publicChangelogRouter);
app.use('/public/api/products', publicProductRouter);

// 9. Auth middleware for protected routes
app.use('/api', authMiddleware);

// 10. Protected API routes
app.use('/api/products', productRouter);
app.use('/api/changelogs', changelogRouter);
app.use('/api/users', userRouter);

// 11. API error handler
app.use('/api', apiErrorHandler);
app.use('/public/api', apiErrorHandler);

// 12. Angular SSR catch-all
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
        const prismaUser = await userService.findByAuth0Id(authContext.user.sub);
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

  angularApp
    .handle(req, { auth: authContext })
    .then((response) => {
      if (response) {
        return writeResponseToNodeResponse(response, res);
      }
      return next();
    })
    .catch(next);
});

// 13. Global error handler
app.use((error: Error, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  serverLogger.error({ err: error }, 'Unhandled error');
  res.status(500).json({ error: 'Internal Server Error' });
});

export function startServer() {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    serverLogger.info(`Node Express server listening on http://localhost:${port}`);
  });
}

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  startServer();
}

export const reqHandler = createNodeRequestHandler(app);
